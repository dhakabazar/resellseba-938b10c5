// Server-only shared plumbing for the automatic payment gateways.
// Never imported by client code (filename is server-guarded).
import { getRequest } from "@tanstack/react-start/server";
import { gatewayBase } from "./registry";

export type GatewayCreds = {
  provider: string;
  api_key: string;
  api_secret: string;
  merchant_id: string;
  config: Record<string, any>;
  /** Resolved API base URL (registry production host, or the admin override). */
  base: string;
  /**
   * Who owns the merchant account the money lands in:
   * - "platform" → the admin's global gateway (admin receives the money)
   * - "reseller" → the reseller's own gateway (reseller receives the money)
   * This decides `orders.advance_by`, so profit math credits the right side.
   */
  owner: "platform" | "reseller";
};

export type GatewayOrder = {
  id: string;
  order_number: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  address_line: string;
  city: string | null;
  reseller_id: string | null;
  payment_status: string;
  payment_provider: string | null;
  paid_amount: number | null;
  transaction_id: string | null;
  advance_amount: number | null;
  advance_by: string | null;
};

export async function admin() {
  const { gatewayDatabase } = await import("@/lib/gateway-database.server");
  return gatewayDatabase();
}

/**
 * Picks the gateway row that applies to a store, shared by credential loading
 * and the storefront gateway listing.
 */
export function resolveGatewayRow<T extends { reseller_id: string | null; is_active: boolean; mode?: string | null }>(
  rows: T[],
  resellerId: string | null,
): T | null {
  const platform = rows.find((r) => r.reseller_id === null) ?? null;
  const mine = resellerId ? (rows.find((r) => r.reseller_id === resellerId) ?? null) : null;
  if (mine) {
    if (!mine.is_active) return null;
    if ((mine.mode ?? "own") === "platform") return platform && platform.is_active ? platform : null;
    return mine;
  }
  return platform && platform.is_active ? platform : null;
}
/**
 * Credential loader.

 *
 * A reseller row, when present, decides everything for that store:
 * - `is_active = false` → the gateway is off for this store (no platform fallback)
 * - `mode = 'platform'` → the store reuses the admin's global gateway (admin gets the money)
 * - `mode = 'own'`      → the reseller's own merchant credentials are used
 * With no reseller row at all the platform gateway is used, as before.
 */
export async function getCredentials(
  provider: string,
  resellerId: string | null,
): Promise<GatewayCreds | null> {
  const db = await admin();
  const q = db
    .from("payment_gateway_configs")
    .select("provider,api_key,api_secret,merchant_id,config,is_active,reseller_id,mode")
    .eq("provider", provider);
  const { data } = resellerId
    ? await q.or(`reseller_id.eq.${resellerId},reseller_id.is.null`)
    : await q.is("reseller_id", null);
  const row = resolveGatewayRow((data ?? []) as any[], resellerId);
  if (!row) return null;

  const config = (row.config ?? {}) as Record<string, any>;
  return {
    provider,
    api_key: row.api_key ?? "",
    api_secret: row.api_secret ?? "",
    merchant_id: row.merchant_id ?? "",
    config,
    base: gatewayBase(provider, config),
    owner: row.reseller_id ? "reseller" : "platform",
  };
}

/** Same shape from a raw admin form, for the "Test connection" action. */
export function credsFromRaw(provider: string, raw: Record<string, any>): GatewayCreds {
  const config = (raw.config ?? {}) as Record<string, any>;
  return {
    provider,
    api_key: String(raw.api_key ?? ""),
    api_secret: String(raw.api_secret ?? ""),
    merchant_id: String(raw.merchant_id ?? ""),
    config,
    base: gatewayBase(provider, config),
    owner: raw.reseller_id ? "reseller" : "platform",
  };
}

/** Platform-level (admin) credentials only — used for security deposit payments. */
export async function getPlatformCredentials(provider: string): Promise<GatewayCreds | null> {
  return getCredentials(provider, null);
}

export async function loadOrder(orderNumber: string): Promise<GatewayOrder> {
  const db = await admin();
  const { data } = await db
    .from("orders")
    .select(
      "id,order_number,total,customer_name,customer_phone,customer_email,address_line,city,reseller_id,payment_status,payment_provider,paid_amount,transaction_id,advance_amount,advance_by",
    )
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (!data) throw new Error("Order not found");
  return data as unknown as GatewayOrder;
}

/** Public origin of this deployment, derived from the request (nothing hardcoded). */
export function siteOrigin(): string {
  try {
    const request = getRequest();
    const headers = request?.headers;
    if (headers) {
      const host = headers.get("x-forwarded-host") ?? headers.get("host");
      const proto = headers.get("x-forwarded-proto") ?? "https";
      if (host) return `${proto}://${host}`;
    }
    if (request?.url) return new URL(request.url).origin;
  } catch {
    /* no request context */
  }
  return process.env["SITE_URL"] || "";
}

/** Every outbound create call is capped so a slow gateway can't hang checkout. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error("Gateway timeout");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function jsonPost(url: string, body: unknown, headers: Record<string, string> = {}, signal?: AbortSignal) {
  const res = await callGateway(url, () =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal,
    }),
  );
  return parseBody(res);
}

/**
 * A gateway host that does not resolve (wrong/renamed API URL) surfaces as a
 * bare "fetch failed", which tells nobody anything. Turn it into an actionable
 * message naming the host so the admin can correct the API base URL.
 */
async function callGateway<T>(url: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort|timeout|timed out/i.test(msg)) throw err;
    let host = url;
    try {
      host = new URL(url).host;
    } catch {
      /* keep raw url */
    }
    throw new Error(
      `Could not reach the payment gateway at ${host}. Check the gateway's API base URL in Payment methods.`,
    );
  }
}

export async function formPost(url: string, body: URLSearchParams, signal?: AbortSignal) {
  const res = await callGateway(url, () => fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: body.toString(),
    signal,
  }));
  return parseBody(res);
}

export async function getJson(url: string, headers: Record<string, string> = {}, signal?: AbortSignal) {
  const res = await callGateway(url, () =>
    fetch(url, { headers: { accept: "application/json", ...headers }, signal }),
  );
  return parseBody(res);
}

async function parseBody(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __raw: text, __status: res.status, __url: res.url, __redirected: res.redirected };
  }
}

/**
 * Final redirect targets on the storefront the shopper is actually browsing:
 * - success → the order "thanks" page (verified payment result shows there)
 * - cancel / fail → back to checkout, so the shopper can retry or pick COD
 */
export function spaUrls(origin: string, code: string, orderNumber: string) {
  const store = `${origin}/s/${encodeURIComponent(code)}`;
  return {
    success: `${store}/thanks?n=${encodeURIComponent(orderNumber)}`,
    cancel: `${store}/checkout?pay=cancelled`,
  };
}

/**
 * The origin a payment starts on is derived from the incoming request, so it is
 * trustworthy at that moment — but the gateway returns to the platform origin,
 * where it arrives as a plain query parameter again. To keep the shopper (or
 * reseller) on the exact site they started from — a platform custom domain, a
 * reseller domain, the published site, anything — the success/cancel targets are
 * signed when the payment is created and the signature is checked on return.
 * A valid signature proves the URL is the one this server built.
 */
function returnSecret(): string {
  const env = process.env as Record<string, string | undefined>;
  return (
    env["SUPABASE_SERVICE_ROLE_KEY"] ||
    env["SUPABASE_PUBLISHABLE_KEY"] ||
    env["SUPABASE_ANON_KEY"] ||
    "lovable-return-secret"
  );
}

async function hmacHex(message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(returnSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Signature over the return targets, attached to every gateway callback URL. */
export async function signTargets(success: string, cancel: string): Promise<string> {
  return (await hmacHex(`${success}\n${cancel}`)).slice(0, 32);
}

export async function verifyTargets(
  success: string | undefined,
  cancel: string | undefined,
  sig: string | undefined,
): Promise<boolean> {
  if (!success || !cancel || !sig) return false;
  const expected = await signTargets(success, cancel);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const u = new URL(success);
    const c = new URL(cancel);
    return (
      (u.protocol === "https:" || u.protocol === "http:") && (c.protocol === "https:" || c.protocol === "http:")
    );
  } catch {
    return false;
  }
}

/** Gateway return params are user-controlled, so only redirect inside this same storefront origin. */
export function safeReturnTarget(raw: string | undefined, origin: string): string {
  const fallback = origin || "/";
  if (!raw) return fallback;
  if (!origin) return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
  try {
    const base = new URL(origin);
    const target = new URL(raw, base);
    if (target.origin === base.origin) return target.toString();
  } catch {
    /* invalid redirect target */
  }
  return fallback;
}

/**
 * The gateway always returns to the origin that holds the privileged key, but
 * the shopper started on their own storefront (a reseller custom domain, the
 * published site, or a preview host). A same-origin-only check would drop them
 * on the wrong website, so any host the platform itself owns is allowed:
 * this origin, the configured callback origin, platform hosting hosts, and
 * every custom domain registered by a reseller. Everything else falls back.
 */
export async function resolveReturnTarget(raw: string | undefined, origin: string): Promise<string> {
  const fallback = safeReturnTarget(raw, origin);
  if (!raw) return fallback;
  let target: URL;
  try {
    target = new URL(raw, origin || undefined);
  } catch {
    return fallback;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return fallback;
  if (origin) {
    try {
      if (target.origin === new URL(origin).origin) return target.toString();
    } catch {
      /* ignore */
    }
  }

  const host = target.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com"))
    return target.toString();

  try {
    const { platformOrigin } = await import("./bridge.server");
    const base = await platformOrigin("");
    if (base && new URL(base).hostname.toLowerCase() === host) return target.toString();
  } catch {
    /* callback base not configured */
  }

  const bare = host.replace(/^www\./, "");
  try {
    const db = await admin();
    const [{ data: domains }, { data: settings }] = await Promise.all([
      db.from("reseller_domains").select("hostname").ilike("hostname", host).limit(1),
      db.from("global_settings").select("allowed_origins").eq("id", 1).maybeSingle(),
    ]);
    if (domains && domains.length > 0) return target.toString();
    // The platform's own live domains (admin-managed list) are always allowed,
    // so a payment started on any connected domain returns to that same site.
    const allowed = ((settings as { allowed_origins?: string[] } | null)?.allowed_origins ?? [])
      .map((h) => String(h).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
      .filter(Boolean);
    if (allowed.includes(bare)) return target.toString();
  } catch {
    /* domain lookup unavailable */
  }
  return fallback;
}



/** Return-URL base every gateway is pointed at (never the SPA directly). */
export function returnUrl(
  origin: string,
  provider: string,
  params: Record<string, string>,
): string {
  const qs = new URLSearchParams(params).toString();
  return `${origin}/api/public/payment/${provider}/return?${qs}`;
}

/**
 * Records the verified result of an online payment on the order.
 *
 * - Never trusts the redirect: the caller must pass a server-verified amount.
 * - Follows the normal payment-method logic: full amount → `paid`,
 *   part of the bill → `partial`, nothing → `unpaid`.
 * - The money is an advance the customer already paid, so it is stored as
 *   `advance_amount` with `advance_by` set from the merchant account owner:
 *   the admin's global gateway → "admin", the reseller's own gateway →
 *   "reseller". Profit math then credits the right side automatically.
 * - `received_amount` (courier COD collection) is deliberately untouched.
 */
export async function settlePayment(opts: {
  order: GatewayOrder;
  provider: string;
  paid: boolean;
  amount: number;
  txnId: string;
  owner?: "platform" | "reseller";
}): Promise<"paid" | "partial" | "unpaid" | "already"> {
  const db = await admin();
  if (opts.order.payment_status === "paid") return "already";
  if (!opts.paid || !(opts.amount > 0)) {
    await db
      .from("orders")
      .update({ payment_provider: opts.provider, transaction_id: opts.txnId || null })
      .eq("id", opts.order.id);
    return "unpaid";
  }

  const expected = Number(opts.order.total || 0);
  const already = Math.max(Number(opts.order.paid_amount ?? 0), 0);
  const totalPaid = Math.round((already + opts.amount) * 100) / 100;
  const full = totalPaid >= expected - 0.5;

  const prevAdvance = Math.max(Number(opts.order.advance_amount ?? 0), 0);
  const holder = opts.owner === "reseller" ? "reseller" : "admin";
  const advanceBy = prevAdvance > 0 ? (opts.order.advance_by ?? holder) : holder;
  const advanceAmount = Math.round((prevAdvance + opts.amount) * 100) / 100;

  const overpaid = totalPaid > expected + 1;
  await db
    .from("orders")
    .update({
      payment_status: full ? "paid" : "partial",
      payment_provider: opts.provider,
      transaction_id: opts.txnId || null,
      paid_amount: totalPaid,
      paid_at: full ? new Date().toISOString() : null,
      advance_amount: advanceAmount,
      advance_by: advanceBy,
      ...(overpaid
        ? {
            admin_note: `OVERPAID: gateway ${opts.provider} reported ${totalPaid}, order total ${expected} (txn ${opts.txnId || "-"})`,
          }
        : {}),
    })
    .eq("id", opts.order.id);
  return full ? "paid" : "partial";
}

/* ------------------------------------------------------------ security deposit */

export type DepositIntent = {
  id: string;
  code: string;
  reseller_id: string;
  amount: number;
  status: string;
  provider: string | null;
  txn_id: string | null;
};

export function newDepositCode(): string {
  const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEP${Date.now().toString(36).toUpperCase().slice(-5)}${rnd}`;
}

/** Adapters speak "order"; a deposit is presented to them as a 1-line order. */
export function depositAsOrder(intent: DepositIntent, reseller?: { name?: string; phone?: string }): GatewayOrder {
  return {
    id: intent.id,
    order_number: intent.code,
    total: Number(intent.amount || 0),
    customer_name: reseller?.name || "Security deposit",
    customer_phone: reseller?.phone || "01700000000",
    customer_email: null,
    address_line: "Security deposit",
    city: "Dhaka",
    reseller_id: intent.reseller_id,
    payment_status: intent.status === "approved" ? "paid" : "unpaid",
    payment_provider: intent.provider,
    paid_amount: null,
    transaction_id: intent.txn_id,
    advance_amount: null,
    advance_by: null,
  };
}

export async function loadDepositIntent(code: string): Promise<DepositIntent | null> {
  const db = await admin();
  const { data } = await db
    .from("deposit_requests")
    .select("id,code,reseller_id,amount,status,provider,txn_id")
    .eq("code", code)
    .maybeSingle();
  return (data as unknown as DepositIntent) ?? null;
}

/**
 * Confirms a gateway-paid security deposit: credits the reseller ledger once
 * and marks the request approved. Idempotent on the deposit request status.
 */
export async function settleDeposit(opts: {
  intent: DepositIntent;
  provider: string;
  paid: boolean;
  amount: number;
  txnId: string;
}): Promise<"paid" | "already" | "unpaid"> {
  const db = await admin();
  if (opts.intent.status === "approved") return "already";
  if (!opts.paid || !(opts.amount > 0)) {
    await db
      .from("deposit_requests")
      .update({ provider: opts.provider, txn_id: opts.txnId || null })
      .eq("id", opts.intent.id);
    return "unpaid";
  }
  const { data: deposit } = await db
    .from("reseller_deposits")
    .insert({
      reseller_id: opts.intent.reseller_id,
      amount: opts.amount,
      method: opts.provider,
      reference: opts.txnId || opts.intent.code,
      note: `Online security deposit via ${opts.provider}`,
    })
    .select("id")
    .single();
  await db
    .from("deposit_requests")
    .update({
      status: "approved",
      provider: opts.provider,
      txn_id: opts.txnId || null,
      amount: opts.amount,
      paid_at: new Date().toISOString(),
      reviewed_at: new Date().toISOString(),
      admin_note: "Auto-approved: verified online payment",
      deposit_id: (deposit as { id: string } | null)?.id ?? null,
    })
    .eq("id", opts.intent.id);
  return "paid";
}

/** Gateways form-POST the return URL, so redirect with HTML, not a 302. */
export function htmlRedirect(target: string): Response {
  const safe = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return new Response(
    `<!doctype html><meta http-equiv="refresh" content="0;url=${safe}">` +
      `<script>location.replace(${JSON.stringify(target)})</script>` +
      `<p>Redirecting…</p>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export function appendFlag(url: string, flag: string, status: string, txnId?: string) {
  const sep = url.includes("?") ? "&" : "?";
  const extra = txnId ? `&txn=${encodeURIComponent(txnId)}` : "";
  return `${url}${sep}${flag}=1&pay=${encodeURIComponent(status)}${extra}`;
}
