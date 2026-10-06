/**
 * Production-ready Marketing & Tracking suite.
 * Supports:
 * - Meta Pixel (Facebook) + Conversions API (CAPI)
 * - TikTok Pixel + TikTok Events API
 * - Google Analytics 4 (GA4) / GTM
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    ttq?: { track: (...args: unknown[]) => void; load: (id: string) => void; page: () => void };
    __loadedFbPixels?: Set<string>;
    __loadedTtPixels?: Set<string>;
    __loadedGa4Ids?: Set<string>;
    __trackingLoaded?: boolean;
  }
}

export type TrackingConfig = {
  fb_pixel?: string | null;
  ga4_id?: string | null;
  tiktok_pixel?: string | null;
};

export type PixelRow = {
  platform: string;
  pixel_id: string | null;
  reseller_id?: string | null;
  is_global?: boolean | null;
};

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

export function getTrackingCookies() {
  if (typeof window === "undefined") {
    return { fbp: undefined, fbc: undefined, ttp: undefined, userAgent: undefined };
  }
  return {
    fbp: getCookie("_fbp") || undefined,
    fbc: getCookie("_fbc") || undefined,
    ttp: getCookie("_ttp") || undefined,
    userAgent: window.navigator.userAgent,
  };
}

/** Ingest and store fbclid/ttclid from URL if present */
function captureClickIds() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid && !getCookie("_fbc")) {
      const creationTime = Date.now();
      document.cookie = `_fbc=fb.1.${creationTime}.${fbclid};path=/;max-age=7776000;SameSite=Lax`;
    }
    const ttclid = params.get("ttclid");
    if (ttclid && !getCookie("_ttp")) {
      document.cookie = `_ttp=${ttclid};path=/;max-age=7776000;SameSite=Lax`;
    }
  } catch {
    // ignore
  }
}

/**
 * Injects pixels from rows fetched by the storefront bootstrap call.
 * Prioritizes reseller-owned pixel (reseller_id is non-null), falls back to platform-wide global pixel.
 */
export function injectTrackingFromRows(rows: PixelRow[] | null | undefined): TrackingConfig {
  const list = rows ?? [];
  const pick = (platform: string) => {
    // 1. Reseller-specific pixel row (has reseller_id)
    const resRow = list.find((r) => r.platform === platform && Boolean(r.reseller_id));
    if (resRow?.pixel_id) return resRow.pixel_id.trim();

    // 2. Explicit non-global row
    const nonGlobal = list.find((r) => r.platform === platform && r.is_global === false);
    if (nonGlobal?.pixel_id) return nonGlobal.pixel_id.trim();

    // 3. Fallback to global row
    const globalRow = list.find((r) => r.platform === platform);
    return globalRow?.pixel_id ? globalRow.pixel_id.trim() : null;
  };

  const cfg: TrackingConfig = {
    fb_pixel: pick("facebook"),
    ga4_id: pick("ga4"),
    tiktok_pixel: pick("tiktok"),
  };
  injectTracking(cfg);
  return cfg;
}

function ensureFbqStub() {
  if (typeof window === "undefined") return;
  if (!window.fbq) {
    const n: any = (window.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
  }
}

export function injectTracking(cfg: TrackingConfig) {
  if (typeof window === "undefined") return;
  captureClickIds();
  ensureFbqStub();

  if (!window.__loadedFbPixels) window.__loadedFbPixels = new Set();
  if (!window.__loadedTtPixels) window.__loadedTtPixels = new Set();
  if (!window.__loadedGa4Ids) window.__loadedGa4Ids = new Set();

  // 1. Facebook Pixel
  const fbPixel = cfg.fb_pixel?.trim();
  if (fbPixel) {
    if (!window.__loadedFbPixels.has(fbPixel)) {
      window.__loadedFbPixels.add(fbPixel);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (function (f: any, b: Document, e: string, v: string) {
        if (f.fbq && f.fbq.version) return;
        const n: any = (f.fbq = function (...args: unknown[]) {
          n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = true;
        n.version = "2.0";
        n.queue = [];
        const t = b.createElement(e) as HTMLScriptElement;
        t.async = true;
        t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s.parentNode?.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

      window.fbq?.("init", fbPixel);
      window.fbq?.("track", "PageView");
    }
  }

  // 2. Google Analytics 4 (GA4)
  const ga4Id = cfg.ga4_id?.trim();
  if (ga4Id && !window.__loadedGa4Ids.has(ga4Id)) {
    window.__loadedGa4Ids.add(ga4Id);

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.gtag = function (...args: any[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4Id, { send_page_view: true });
  }

  // 3. TikTok Pixel
  const ttPixel = cfg.tiktok_pixel?.trim();
  if (ttPixel && !window.__loadedTtPixels.has(ttPixel)) {
    window.__loadedTtPixels.add(ttPixel);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttq: any = (w[t] = w[t] || []);
      ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
      ];
      ttq.setAndDefer = function (o: any, m: string) {
        o[m] = function (...a: unknown[]) {
          o.push([m, ...a]);
        };
      };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e: string) {
        const s = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = s;
        const n = d.createElement("script") as HTMLScriptElement;
        n.async = true;
        n.src = s + "?sdkid=" + e + "&lib=" + t;
        const a = d.getElementsByTagName("script")[0];
        a.parentNode?.insertBefore(n, a);
      };
    })(window, document, "ttq");

    window.ttq?.load(ttPixel);
    window.ttq?.page();
  }
}

/** 1. PageView Tracking */
export function trackPageView(url?: string) {
  const eventId = `pv_${Date.now()}`;
  window.fbq?.("track", "PageView", { eventID: eventId }, { eventID: eventId });
  window.ttq?.page();
  window.gtag?.("event", "page_view", {
    page_location: url || (typeof window !== "undefined" ? window.location.href : undefined),
    event_id: eventId,
  });
}

/** 2. ViewContent Tracking */
export function trackViewContent(p: {
  id: string;
  name: string;
  price: number;
  currency?: string;
  eventId?: string;
}) {
  const currency = p.currency ?? "BDT";
  const eventId = p.eventId ?? `vc_${p.id}_${Date.now()}`;

  // Facebook
  window.fbq?.(
    "track",
    "ViewContent",
    {
      content_ids: [p.id],
      content_name: p.name,
      content_type: "product",
      value: p.price,
      currency,
      contents: [{ id: p.id, quantity: 1, item_price: p.price }],
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "view_item", {
    currency,
    value: p.price,
    event_id: eventId,
    transaction_id: eventId,
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }],
  });

  // TikTok
  window.ttq?.track(
    "ViewContent",
    {
      content_id: p.id,
      content_name: p.name,
      content_type: "product",
      value: p.price,
      currency,
      contents: [{ content_id: p.id, content_name: p.name, quantity: 1, price: p.price }],
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}

/** 3. AddToCart Tracking */
export function trackAddToCart(p: {
  id: string;
  name: string;
  price: number;
  qty: number;
  currency?: string;
  eventId?: string;
}) {
  const currency = p.currency ?? "BDT";
  const value = p.price * p.qty;
  const eventId = p.eventId ?? `atc_${p.id}_${Date.now()}`;

  // Facebook
  window.fbq?.(
    "track",
    "AddToCart",
    {
      content_ids: [p.id],
      content_name: p.name,
      content_type: "product",
      value,
      currency,
      num_items: p.qty,
      contents: [{ id: p.id, quantity: p.qty, item_price: p.price }],
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "add_to_cart", {
    currency,
    value,
    event_id: eventId,
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: p.qty }],
  });

  // TikTok
  window.ttq?.track(
    "AddToCart",
    {
      content_id: p.id,
      content_name: p.name,
      content_type: "product",
      value,
      currency,
      quantity: p.qty,
      contents: [{ content_id: p.id, content_name: p.name, quantity: p.qty, price: p.price }],
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}

/** 4. InitiateCheckout Tracking */
export function trackInitiateCheckout(p: {
  items: Array<{ id: string; name: string; price: number; qty: number }>;
  total: number;
  currency?: string;
  eventId?: string;
}) {
  const currency = p.currency ?? "BDT";
  const eventId = p.eventId ?? `ic_${Date.now()}`;
  const totalQty = p.items.reduce((s, i) => s + i.qty, 0);

  // Facebook
  window.fbq?.(
    "track",
    "InitiateCheckout",
    {
      content_ids: p.items.map((i) => i.id),
      contents: p.items.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })),
      content_type: "product",
      value: p.total,
      currency,
      num_items: totalQty,
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "begin_checkout", {
    currency,
    value: p.total,
    event_id: eventId,
    transaction_id: eventId,
    items: p.items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price,
      quantity: i.qty,
    })),
  });

  // TikTok
  window.ttq?.track(
    "InitiateCheckout",
    {
      contents: p.items.map((i) => ({
        content_id: i.id,
        content_name: i.name,
        quantity: i.qty,
        price: i.price,
      })),
      value: p.total,
      currency,
      quantity: totalQty,
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}

/** 5. Purchase Tracking */
export function trackPurchase(p: {
  orderNumber: string;
  total: number;
  currency?: string;
  eventId?: string;
  items?: Array<{ id: string; name: string; price: number; qty: number }>;
}) {
  const currency = p.currency ?? "BDT";
  const eventId = p.eventId ?? `pur_${p.orderNumber}`;
  const totalQty = p.items ? p.items.reduce((s, i) => s + i.qty, 0) : 1;

  // Facebook
  window.fbq?.(
    "track",
    "Purchase",
    {
      value: p.total,
      currency,
      content_type: "product",
      num_items: totalQty,
      content_ids: p.items?.map((i) => i.id) || [p.orderNumber],
      contents: p.items?.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })) || [
        { id: p.orderNumber, quantity: 1, item_price: p.total },
      ],
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "purchase", {
    transaction_id: p.orderNumber,
    value: p.total,
    currency,
    event_id: eventId,
    items: p.items?.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price,
      quantity: i.qty,
    })) || [{ item_id: p.orderNumber, item_name: `Order #${p.orderNumber}`, price: p.total, quantity: 1 }],
  });

  // TikTok
  window.ttq?.track(
    "CompletePayment",
    {
      content_id: p.orderNumber,
      value: p.total,
      currency,
      quantity: totalQty,
      contents: p.items?.map((i) => ({
        content_id: i.id,
        content_name: i.name,
        quantity: i.qty,
        price: i.price,
      })) || [{ content_id: p.orderNumber, content_name: `Order #${p.orderNumber}`, quantity: 1, price: p.total }],
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}

/** 6. Search Tracking (Facebook + GA4 + TikTok) */
export function trackSearch(p: { query: string; resultCount?: number; eventId?: string }) {
  const query = (p.query || "").trim();
  if (!query) return;
  const eventId = p.eventId ?? `srch_${Date.now()}`;

  // Facebook
  window.fbq?.(
    "track",
    "Search",
    {
      search_string: query,
      content_type: "product",
      num_items: p.resultCount,
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "search", {
    search_term: query,
    event_id: eventId,
  });

  // TikTok
  window.ttq?.track(
    "Search",
    {
      query: query,
      contents: [{ content_name: query }],
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}

/** 7. Category View Tracking (Facebook + GA4 + TikTok) */
export function trackViewCategory(p: {
  id?: string;
  name: string;
  slug?: string;
  itemCount?: number;
  eventId?: string;
}) {
  const name = (p.name || "").trim();
  if (!name) return;
  const eventId = p.eventId ?? `cat_${p.slug || p.id || "view"}_${Date.now()}`;

  // Facebook (Standard ViewContent on product group + custom ViewCategory)
  window.fbq?.(
    "track",
    "ViewContent",
    {
      content_name: name,
      content_category: name,
      content_type: "product_group",
      num_items: p.itemCount,
      eventID: eventId,
    },
    { eventID: eventId }
  );
  window.fbq?.(
    "trackCustom",
    "ViewCategory",
    {
      content_category: name,
      content_name: name,
      eventID: eventId,
    },
    { eventID: eventId }
  );

  // GA4
  window.gtag?.("event", "view_item_list", {
    item_list_id: p.id || p.slug || name,
    item_list_name: name,
    event_id: eventId,
  });

  // TikTok
  window.ttq?.track(
    "Browse",
    {
      content_name: name,
      content_id: p.id || p.slug,
      event_id: eventId,
    },
    { event_id: eventId }
  );

  return eventId;
}
