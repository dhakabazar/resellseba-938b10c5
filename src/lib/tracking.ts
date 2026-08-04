/**
 * Lightweight client-side pixel injector.
 * Loads FB Pixel + GA4 scripts based on marketing_configs and exposes helpers.
 */
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    ttq?: { track: (...args: unknown[]) => void; load: (id: string) => void; page: () => void };
    __trackingLoaded?: boolean;
  }
}

export type TrackingConfig = {
  fb_pixel?: string | null;
  ga4_id?: string | null;
  tiktok_pixel?: string | null;
};

export async function loadTrackingForReseller(resellerId: string): Promise<TrackingConfig> {
  const [{ data: reseller }, { data: global }] = await Promise.all([
    supabase
      .from("public_marketing_pixels")
      .select("platform,pixel_id")
      .eq("reseller_id", resellerId),
    supabase
      .from("public_marketing_pixels")
      .select("platform,pixel_id")
      .is("reseller_id", null),
  ]);

  const pick = (platform: string) =>
    reseller?.find((r) => r.platform === platform)?.pixel_id ??
    global?.find((r) => r.platform === platform)?.pixel_id ??
    null;

  const cfg: TrackingConfig = {
    fb_pixel: pick("facebook"),
    ga4_id: pick("ga4"),
    tiktok_pixel: pick("tiktok"),
  };
  injectTracking(cfg);
  return cfg;
}

export function injectTracking(cfg: TrackingConfig) {
  if (typeof window === "undefined") return;
  if (window.__trackingLoaded) return;
  window.__trackingLoaded = true;

  if (cfg.fb_pixel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (f: any, b: Document, e: string, v: string) {
      if (f.fbq) return;
      const n: any = (f.fbq = function (...args: unknown[]) {
        n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      const t = b.createElement(e) as HTMLScriptElement;
      t.async = true; t.src = v;
      const s = b.getElementsByTagName(e)[0];
      s.parentNode?.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq?.("init", cfg.fb_pixel);
    window.fbq?.("track", "PageView");
  }

  if (cfg.ga4_id) {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.ga4_id}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.gtag = function (...args: any[]) { window.dataLayer!.push(args); };
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4_id);
  }

  if (cfg.tiktok_pixel) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (function (w: any, d: Document, t: string) {
      w.TiktokAnalyticsObject = t;
      const ttq: any = (w[t] = w[t] || []);
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
      ttq.setAndDefer = function (o: any, m: string) { o[m] = function (...a: unknown[]) { o.push([m, ...a]); }; };
      for (let i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e: string) {
        const s = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = s;
        const n = d.createElement("script") as HTMLScriptElement;
        n.async = true; n.src = s + "?sdkid=" + e + "&lib=" + t;
        const a = d.getElementsByTagName("script")[0];
        a.parentNode?.insertBefore(n, a);
      };
    })(window, document, "ttq");
    window.ttq?.load(cfg.tiktok_pixel);
    window.ttq?.page();
  }
}

export function trackViewContent(p: { id: string; name: string; price: number; currency?: string }) {
  const currency = p.currency ?? "BDT";
  window.fbq?.("track", "ViewContent", { content_ids: [p.id], content_name: p.name, content_type: "product", value: p.price, currency });
  window.gtag?.("event", "view_item", { currency, value: p.price, items: [{ item_id: p.id, item_name: p.name, price: p.price }] });
  window.ttq?.track("ViewContent", { content_id: p.id, content_name: p.name, value: p.price, currency });
}

export function trackAddToCart(p: { id: string; name: string; price: number; qty: number; currency?: string }) {
  const currency = p.currency ?? "BDT";
  const value = p.price * p.qty;
  window.fbq?.("track", "AddToCart", { content_ids: [p.id], content_name: p.name, value, currency });
  window.gtag?.("event", "add_to_cart", { currency, value, items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: p.qty }] });
  window.ttq?.track("AddToCart", { content_id: p.id, content_name: p.name, value, currency });
}

export function trackPurchase(p: { orderNumber: string; total: number; currency?: string; eventId?: string; items?: Array<{ id: string; name: string; price: number; qty: number }> }) {
  const currency = p.currency ?? "BDT";
  window.fbq?.("track", "Purchase", {
    value: p.total,
    currency,
    content_ids: p.items?.map((i) => i.id),
    contents: p.items?.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })),
  }, p.eventId ? { eventID: p.eventId } : undefined);
  window.gtag?.("event", "purchase", {
    transaction_id: p.orderNumber,
    value: p.total,
    currency,
    items: p.items?.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })),
  });
  window.ttq?.track("CompletePayment", { content_id: p.orderNumber, value: p.total, currency, event_id: p.eventId });
}
