/**
 * Server-side product scraper for supported marketplaces (Daraz, Alibaba,
 * AliExpress, Amazon) and any WooCommerce / OG-tagged shop page.
 *
 * Safety rules (never relax):
 * - https only, no credentials in URL, no private / loopback hosts (SSRF)
 * - response body capped, request timed out
 * - no HTML is ever executed or returned raw; we only extract plain text
 * - image URLs must be absolute https and are re-encoded client-side before upload
 */

const MAX_HTML_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?)/i;
const BLOCKED_SUFFIX = /\.(local|internal|localdomain|home|lan)$/i;

export interface ImportedProduct {
  source: string;
  url: string;
  name: string;
  description: string;
  shortDescription: string;
  price: number | null;
  currency: string | null;
  sku: string | null;
  brand: string | null;
  category: string | null;
  images: string[];
  metaTitle: string;
  metaDescription: string;
}

export function assertSafeUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    throw new Error("Invalid link. Paste a full product URL.");
  }
  if (u.protocol !== "https:") throw new Error("Only https links are allowed.");
  if (u.username || u.password) throw new Error("Links with credentials are not allowed.");
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOST.test(host) || BLOCKED_SUFFIX.test(host) || !host.includes("."))
    throw new Error("This host is not allowed.");
  return u;
}

export function sourceLabel(host: string): string {
  const h = host.replace(/^www\./, "");
  if (h.includes("daraz")) return "Daraz";
  if (h.includes("aliexpress")) return "AliExpress";
  if (h.includes("alibaba")) return "Alibaba";
  if (h.includes("amazon")) return "Amazon";
  return h;
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // Marketplaces block unknown agents outright.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,bn;q=0.8",
      },
    });
    if (!res.ok) {
      if ([401, 403, 405, 429, 503].includes(res.status))
        throw new Error(
          `${sourceLabel(new URL(url).hostname)} automated read block korche (${res.status}). Kichukkhon pore try korun ba manually add korun.`,
        );
      if (res.status === 404) throw new Error("Link ta pawa jacche na (404). Product page URL ta abar copy korun.");
      throw new Error(`Source responded ${res.status}. The page may be blocked or removed.`);
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) throw new Error("Page is too large to import.");
    return new TextDecoder("utf-8").decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

/** Strips tags/scripts and decodes basic entities — output is plain text only. */
export function toPlainText(html: string, limit = 4000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);
}

function meta(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${esc}["'][^>]*content=["']([^"']+)["']`,
      "i",
    );
    const alt = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${esc}["']`,
      "i",
    );
    const m = html.match(re) ?? html.match(alt);
    if (m?.[1]) return toPlainText(m[1], 600);
  }
  return null;
}

function jsonLdBlocks(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]!.trim());
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      /* ignore malformed blocks */
    }
  }
  const flat: any[] = [];
  for (const node of out) {
    flat.push(node);
    if (Array.isArray(node?.["@graph"])) flat.push(...node["@graph"]);
  }
  return flat;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}\b)/g, "");
    const n = Number(cleaned.replace(/,/g, "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function cleanImages(list: unknown[], base: URL): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    let s = typeof raw === "string" ? raw : (raw as any)?.url ?? (raw as any)?.src;
    if (typeof s !== "string") continue;
    s = s.trim();
    if (s.startsWith("//")) s = `https:${s}`;
    if (!/^https:\/\//i.test(s)) continue;
    try {
      const u = new URL(s, base);
      if (u.protocol !== "https:") continue;
      // Strip marketplace resize suffixes so we grab the largest variant.
      const key = u.href.replace(/_\d+x\d+(q\d+)?(\.\w+)?(?=(\.|$))/i, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(u.href);
    } catch {
      /* skip */
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** Marketplace-specific image + price hints when JSON-LD is missing. */
function harvestExtras(html: string): { images: string[]; price: number | null } {
  const images: string[] = [];
  const imgRe = /"(?:image|images|imgUrl|hiRes|large|src)"\s*:\s*"((?:https:)?\/\/[^"']+?\.(?:jpg|jpeg|png|webp)[^"']*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) && images.length < 30) images.push(m[1]!);

  // Values may be plain numbers or currency-prefixed strings ("৳ 275.00", "BDT 1,250"),
  // and may appear inside escaped JSON (\"price\":\"...\").
  let price: number | null = null;
  const priceRe =
    /\\?"(?:salePrice|priceValue|discountedPrice|minPrice|formattedPrice|priceAmount|price)\\?"\s*:\s*\\?"?\s*([^",}\\]{1,32})/gi;
  let pm: RegExpExecArray | null;
  while ((pm = priceRe.exec(html))) {
    const candidate = num(pm[1]);
    if (candidate) {
      price = candidate;
      break;
    }
  }
  return { images, price };
}


/** Decodes JSON-string escapes (Daraz/AliExpress embed description as escaped HTML). */
function decodeJsonString(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

/** Reads one JSON string value starting right after `"key":"` without full parsing. */
function readJsonStringValue(html: string, key: string): string | null {
  const marker = new RegExp(`"${key}"\\s*:\\s*"`, "i");
  let from = 0;
  for (let guard = 0; guard < 20; guard++) {
    const rest = html.slice(from);
    const m = rest.match(marker);
    if (!m || m.index === undefined) return null;
    const start = from + m.index + m[0].length;
    let i = start;
    while (i < html.length && i - start < 60_000) {
      const ch = html[i];
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') break;
      i += 1;
    }
    const value = decodeJsonString(html.slice(start, i));
    const text = toPlainText(value, 6000);
    if (text.length > 60) return value;
    from = i + 1;
  }
  return null;
}

/** Grabs the chunk after a container's opening tag — tags are stripped later anyway. */
function sliceAfter(html: string, re: RegExp, len = 30_000): string | null {
  const m = html.match(re);
  if (!m || m.index === undefined) return null;
  return html.slice(m.index + m[0].length, m.index + m[0].length + len);
}

/**
 * Marketplace / WooCommerce description harvesting used when JSON-LD and OG
 * tags carry nothing useful (Daraz keeps it inside embedded module JSON).
 */
export function harvestDescription(html: string): string {
  // 1) Embedded JSON (Daraz pdp module, AliExpress, Shopify, WooCommerce Store API)
  for (const key of [
    "descriptionHtml",
    "detailDescription",
    "productDescription",
    "html",
    "description",
    "body_html",
  ]) {
    const raw = readJsonStringValue(html, key);
    const text = raw ? toPlainText(raw) : "";
    if (text.length > 60) return text;
  }

  // 2) Known description containers
  const containers: RegExp[] = [
    /<div[^>]+id=["']module_product_detail["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*pdp-product-desc[^"']*["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*html-content[^"']*["'][^>]*>/i,
    /<div[^>]+id=["']productDescription["'][^>]*>/i,
    /<div[^>]+id=["']feature-bullets["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*woocommerce-Tabs-panel--description[^"']*["'][^>]*>/i,
    /<div[^>]+class=["'][^"']*woocommerce-product-details__short-description[^"']*["'][^>]*>/i,
    /<div[^>]+id=["']tab-description["'][^>]*>/i,
    /<[^>]+itemprop=["']description["'][^>]*>/i,
  ];
  for (const re of containers) {
    const chunk = sliceAfter(html, re);
    const text = chunk ? toPlainText(chunk) : "";
    if (text.length > 60) return text;
  }
  return "";
}

/** Anti-bot / captcha interstitials must not be imported as product data. */
function assertNotBlocked(html: string, host: string) {
  if (/rgv587_flag|_____tmd_____|x5secdata|captcha-delivery|Enable JavaScript and cookies to continue|Are you a human/i.test(html.slice(0, 4000)))
    throw new Error(
      `${sourceLabel(host)} blocked the automated read (bot check). Kichukkhon pore abar try korun, ba onno product link din.`,
    );
}


export async function scrapeProduct(rawUrl: string): Promise<ImportedProduct> {
  const url = assertSafeUrl(rawUrl);
  const html = await fetchText(url.href);
  assertNotBlocked(html, url.hostname);

  const blocks = jsonLdBlocks(html);
  const product =
    blocks.find((b) => {
      const t = b?.["@type"];
      return t === "Product" || (Array.isArray(t) && t.includes("Product"));
    }) ?? null;

  const offersRaw = product?.offers;
  const offer = Array.isArray(offersRaw) ? offersRaw[0] : offersRaw;
  const extras = harvestExtras(html);

  const name =
    (typeof product?.name === "string" ? toPlainText(product.name, 200) : null) ??
    meta(html, "og:title", "twitter:title") ??
    toPlainText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "", 200);

  if (!name)
    throw new Error(
      `${sourceLabel(url.hostname)} theke product data pawa gelo na — page ta login/bot-protected hote pare. Onno link try korun ba manually add korun.`,
    );


  const ldDesc = typeof product?.description === "string" ? toPlainText(product.description) : "";
  const metaDesc = toPlainText(meta(html, "og:description", "description", "twitter:description") ?? "");
  const deepDesc = ldDesc.length > 120 ? "" : harvestDescription(html);
  // Longest meaningful text wins — Daraz keeps the real detail in module JSON.
  const description = [ldDesc, deepDesc, metaDesc].sort((a, b) => b.length - a.length)[0] ?? "";


  const price =
    num(offer?.price) ??
    num(offer?.lowPrice) ??
    num(offer?.priceSpecification?.price) ??
    num(meta(html, "product:price:amount", "og:price:amount")) ??
    extras.price;

  const imageCandidates = [
    ...(Array.isArray(product?.image) ? product.image : product?.image ? [product.image] : []),
    meta(html, "og:image", "twitter:image") ?? "",
    ...extras.images,
  ];

  const brandRaw = product?.brand;
  const brand =
    typeof brandRaw === "string"
      ? toPlainText(brandRaw, 80)
      : typeof brandRaw?.name === "string"
        ? toPlainText(brandRaw.name, 80)
        : (meta(html, "product:brand") ?? null);

  const catRaw = product?.category;
  const category =
    typeof catRaw === "string"
      ? toPlainText(catRaw.split(">").pop() ?? catRaw, 80)
      : (meta(html, "product:category") ?? null);

  return {
    source: sourceLabel(url.hostname),
    url: url.href,
    name,
    description,
    shortDescription: description.slice(0, 200),
    price,
    currency:
      (typeof offer?.priceCurrency === "string" ? offer.priceCurrency.slice(0, 6) : null) ??
      meta(html, "product:price:currency", "og:price:currency"),
    sku:
      (typeof product?.sku === "string" ? toPlainText(product.sku, 60) : null) ??
      (typeof product?.mpn === "string" ? toPlainText(product.mpn, 60) : null),
    brand,
    category,
    images: cleanImages(imageCandidates, url),
    metaTitle: name.slice(0, 60),
    metaDescription: description.slice(0, 160),
  };
}

const IMAGE_MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
];

/** Downloads one remote image and returns verified bytes as base64 (never HTML/scripts). */
export async function fetchRemoteImage(rawUrl: string): Promise<{ base64: string; mime: string }> {
  const url = assertSafeUrl(rawUrl);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.href, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0", accept: "image/*" },
    });
    if (!res.ok) throw new Error(`Image download failed (${res.status}).`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0) throw new Error("Empty image.");
    if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("Image too large.");
    const mime = IMAGE_MAGIC.find((sig) => sig.bytes.every((b, i) => buf[i] === b))?.mime;
    if (!mime) throw new Error("Downloaded file is not a real image — skipped for safety.");

    let binary = "";
    for (let i = 0; i < buf.length; i += 0x8000)
      binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { base64: btoa(binary), mime };
  } finally {
    clearTimeout(timer);
  }
}
