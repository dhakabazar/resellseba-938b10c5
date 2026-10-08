import { createClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/env-bridge";
import { pageViewInput, viewContentInput, initiateCheckoutInput, purchaseInput } from "./capi-schemas";
import { z } from "zod";
import { createHash } from "crypto";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

function normalizePhoneHashes(rawPhone?: string | null): string[] | undefined {
  if (!rawPhone) return undefined;
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return undefined;
  const hashes = new Set<string>();
  if (digits.startsWith("01")) {
    hashes.add(sha256(`88${digits}`));
    hashes.add(sha256(digits));
  } else if (digits.startsWith("8801")) {
    hashes.add(sha256(digits));
    hashes.add(sha256(digits.replace(/^88/, "")));
  } else {
    hashes.add(sha256(digits));
  }
  return Array.from(hashes);
}

function normalizeNameHashes(rawName?: string | null): { fn?: string[]; ln?: string[] } {
  if (!rawName) return {};
  const parts = rawName.trim().split(/\s+/);
  const fn = parts[0] ? [sha256(parts[0])] : undefined;
  const ln = parts.length > 1 ? [sha256(parts.slice(1).join(" "))] : undefined;
  return { fn, ln };
}

// Helper to get active marketing configs for a store code / reseller id / domain / origin
function publicDb() {
  const url = getRuntimeEnv("SUPABASE_URL")!;
  const key = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY")!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
}

async function getConfigsForStore(supabaseAdmin: any, codeOrResellerId: string, origin?: string) {
  const db = publicDb();
  const { data: ctx, error } = await db.rpc("capi_store_configs" as any, { p_code: codeOrResellerId || "", p_origin: origin ?? null } as any);
  if (error) console.error("[getConfigsForStore]", error.message);
  const resellerId: string | null = (ctx as any)?.reseller_id ?? null;
  const configs: any[] = (ctx as any)?.configs ?? [];
  const pick = (platform: string) => {
    // Reseller row
    const resellerRows = resellerId
      ? configs.filter(
          (c: any) => c.reseller_id === resellerId && c.platform === platform && c.is_active !== false,
        )
      : [];
    const resellerRow =
      resellerRows.find((c: any) => Boolean(c.pixel_id?.trim() && c.access_token?.trim())) ||
      resellerRows[0] ||
      null;

    // Global row
    const globalRows = configs.filter(
      (c: any) => !c.reseller_id && c.platform === platform && c.is_active !== false,
    );
    const globalRow =
      globalRows.find((c: any) => Boolean(c.pixel_id?.trim() && c.access_token?.trim())) ||
      globalRows[0] ||
      null;

    // Merge: Reseller takes precedence; fallback to global access_token or pixel_id if empty
    const pixel_id = (resellerRow?.pixel_id?.trim() || globalRow?.pixel_id?.trim() || "").trim();
    const access_token = (resellerRow?.access_token?.trim() || globalRow?.access_token?.trim() || "").trim();
    const test_event_code = (resellerRow?.test_event_code?.trim() || globalRow?.test_event_code?.trim() || "").trim();

    if (!pixel_id && !access_token) return null;

    return {
      platform,
      pixel_id: pixel_id || null,
      access_token: access_token || null,
      test_event_code: test_event_code || null,
      reseller_id: resellerRow?.reseller_id || null,
      is_active: true,
    };
  };

  return { pick, resellerId, configs };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1. Server-side PageView CAPI
 * ────────────────────────────────────────────────────────────────────────── */

export async function trackPageViewServerImpl(data: z.infer<typeof pageViewInput>) {
  const supabaseAdmin = null;
  const { pick } = await getConfigsForStore(supabaseAdmin, data.code, data.origin);

  const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
  const eventUrl = data.url || origin || undefined;
  const eventTime = Math.floor(Date.now() / 1000);
  const results: Record<string, any> = {};
  const fallbackUa =
    data.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Facebook CAPI
  const fb: any = pick("facebook");
  if (fb?.pixel_id && fb?.access_token) {
    const pixelId = fb.pixel_id.trim();
    const accessToken = fb.access_token.trim();
    const testCode = fb.test_event_code?.trim() || "";

    const payload: any = {
      data: [
        {
          event_name: "PageView",
          event_time: eventTime,
          event_id: data.eventId,
          event_source_url: eventUrl,
          action_source: "website",
          user_data: {
            client_user_agent: fallbackUa,
            fbp: data.fbp || undefined,
            fbc: data.fbc || undefined,
            country: [sha256("bd")],
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("access_token", accessToken);
      if (testCode) queryParams.set("test_event_code", testCode);

      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?${queryParams.toString()}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI Facebook PageView]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.facebook = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI Facebook PageView Error]", err);
      results.facebook = { ok: false, error: err.message };
    }
  } else {
    results.facebook = { ok: false, reason: "Missing Facebook pixel_id or access_token" };
  }

  // TikTok Events API
  const tt: any = pick("tiktok");
  if (tt?.pixel_id && tt?.access_token) {
    const pixelId = tt.pixel_id.trim();
    const accessToken = tt.access_token.trim();
    const testCode = tt.test_event_code?.trim() || "";

    const payload: any = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: "Pageview",
          event_time: eventTime,
          event_id: data.eventId,
          user: {
            ttp: data.ttp || undefined,
          },
          context: {
            page: { url: eventUrl },
            user_agent: fallbackUa,
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI TikTok PageView]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.tiktok = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI TikTok PageView Error]", err);
      results.tiktok = { ok: false, error: err.message };
    }
  }

  return { ok: true, results };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. Server-side ViewContent CAPI
 * ────────────────────────────────────────────────────────────────────────── */

export async function trackViewContentServerImpl(data: z.infer<typeof viewContentInput>) {
  const supabaseAdmin = null;
  const { pick } = await getConfigsForStore(supabaseAdmin, data.code, data.origin);

  const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
  const eventUrl = origin || undefined;
  const eventTime = Math.floor(Date.now() / 1000);
  const results: Record<string, any> = {};
  const fallbackUa =
    data.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Facebook CAPI
  const fb: any = pick("facebook");
  if (fb?.pixel_id && fb?.access_token) {
    const pixelId = fb.pixel_id.trim();
    const accessToken = fb.access_token.trim();
    const testCode = fb.test_event_code?.trim() || "";

    const payload: any = {
      data: [
        {
          event_name: "ViewContent",
          event_time: eventTime,
          event_id: data.eventId,
          event_source_url: eventUrl,
          action_source: "website",
          user_data: {
            client_user_agent: fallbackUa,
            fbp: data.fbp || undefined,
            fbc: data.fbc || undefined,
            country: [sha256("bd")],
          },
          custom_data: {
            currency: "BDT",
            value: Number(data.price),
            content_name: data.productName,
            content_ids: [String(data.productId)],
            content_type: "product",
            contents: [{ id: String(data.productId), quantity: 1, item_price: Number(data.price) }],
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("access_token", accessToken);
      if (testCode) queryParams.set("test_event_code", testCode);

      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?${queryParams.toString()}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI Facebook ViewContent]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.facebook = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI Facebook ViewContent Error]", err);
      results.facebook = { ok: false, error: err.message };
    }
  } else {
    results.facebook = { ok: false, reason: "Missing Facebook pixel_id or access_token" };
  }

  // TikTok Events API
  const tt: any = pick("tiktok");
  if (tt?.pixel_id && tt?.access_token) {
    const pixelId = tt.pixel_id.trim();
    const accessToken = tt.access_token.trim();
    const testCode = tt.test_event_code?.trim() || "";

    const payload: any = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: "ViewContent",
          event_time: eventTime,
          event_id: data.eventId,
          user: {
            ttp: data.ttp || undefined,
          },
          context: {
            page: { url: eventUrl },
            user_agent: fallbackUa,
          },
          properties: {
            currency: "BDT",
            value: Number(data.price),
            content_id: String(data.productId),
            content_name: data.productName,
            content_type: "product",
            contents: [
              {
                content_id: String(data.productId),
                content_name: data.productName,
                quantity: 1,
                price: Number(data.price),
              },
            ],
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI TikTok ViewContent]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.tiktok = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI TikTok ViewContent Error]", err);
      results.tiktok = { ok: false, error: err.message };
    }
  }

  return { ok: true, results };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 3. Server-side InitiateCheckout CAPI
 * ────────────────────────────────────────────────────────────────────────── */

export async function trackInitiateCheckoutServerImpl(data: z.infer<typeof initiateCheckoutInput>) {
  const supabaseAdmin = null;
  const { pick } = await getConfigsForStore(supabaseAdmin, data.code, data.origin);

  const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
  const checkoutUrl = origin ? `${origin}/checkout` : undefined;
  const eventTime = Math.floor(Date.now() / 1000);
  const results: Record<string, any> = {};

  const phoneHashes = normalizePhoneHashes(data.customerPhone);
  const nameHashes = normalizeNameHashes(data.customerName);
  const fallbackUa =
    data.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Facebook CAPI
  const fb: any = pick("facebook");
  if (fb?.pixel_id && fb?.access_token) {
    const pixelId = fb.pixel_id.trim();
    const accessToken = fb.access_token.trim();
    const testCode = fb.test_event_code?.trim() || "";

    const payload: any = {
      data: [
        {
          event_name: "InitiateCheckout",
          event_time: eventTime,
          event_id: data.eventId,
          event_source_url: checkoutUrl,
          action_source: "website",
          user_data: {
            client_user_agent: fallbackUa,
            fbp: data.fbp || undefined,
            fbc: data.fbc || undefined,
            ph: phoneHashes,
            fn: nameHashes.fn,
            ln: nameHashes.ln,
            country: [sha256("bd")],
          },
          custom_data: {
            currency: "BDT",
            value: Number(data.total),
            num_items: data.items.reduce((s, i) => s + i.qty, 0),
            content_type: "product",
            content_ids: data.items.map((i) => String(i.id)),
            contents: data.items.map((i) => ({
              id: String(i.id),
              quantity: Number(i.qty),
              item_price: Number(i.price),
            })),
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("access_token", accessToken);
      if (testCode) queryParams.set("test_event_code", testCode);

      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?${queryParams.toString()}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI Facebook InitiateCheckout]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.facebook = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI Facebook InitiateCheckout Error]", err);
      results.facebook = { ok: false, error: err.message };
    }
  } else {
    results.facebook = { ok: false, reason: "Missing Facebook pixel_id or access_token" };
  }

  // TikTok Events API
  const tt: any = pick("tiktok");
  if (tt?.pixel_id && tt?.access_token) {
    const pixelId = tt.pixel_id.trim();
    const accessToken = tt.access_token.trim();
    const testCode = tt.test_event_code?.trim() || "";

    const payload: any = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: "InitiateCheckout",
          event_time: eventTime,
          event_id: data.eventId,
          user: {
            ttp: data.ttp || undefined,
            phone: phoneHashes?.[0] || undefined,
          },
          context: {
            page: { url: checkoutUrl },
            user_agent: fallbackUa,
          },
          properties: {
            currency: "BDT",
            value: Number(data.total),
            quantity: data.items.reduce((s, i) => s + i.qty, 0),
            contents: data.items.map((i) => ({
              content_id: String(i.id),
              content_name: i.name,
              quantity: Number(i.qty),
              price: Number(i.price),
            })),
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI TikTok InitiateCheckout]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.tiktok = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI TikTok InitiateCheckout Error]", err);
      results.tiktok = { ok: false, error: err.message };
    }
  }

  return { ok: true, results };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 4. Server-side Purchase CAPI
 * ────────────────────────────────────────────────────────────────────────── */

export async function trackPurchaseServerImpl(data: z.infer<typeof purchaseInput>) {
  const supabaseAdmin = null;
  const rawOrderNumber = data.orderNumber.trim();
  const cleanOrderNumber = rawOrderNumber.replace(/^#/, "").trim();

  const { data: od } = await publicDb().rpc("capi_order" as any, { p_order_number: cleanOrderNumber } as any);
  const order: any = od;
  if (!order) {
    console.warn("[trackPurchaseServer] Order not found for orderNumber:", rawOrderNumber);
    return { ok: false, error: "Order not found" };
  }
  const items: any[] = order.order_items ?? [];
  const orderItems = items ?? [];

  // 3. Marketing configs using unified resolver with reseller UUID fallback and origin
  const { pick } = await getConfigsForStore(
    supabaseAdmin,
    order.reseller_id || data.code || "",
    data.origin,
  );

  const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
  const checkoutUrl = origin ? `${origin}/thanks?n=${encodeURIComponent(order.order_number)}` : undefined;

  const eventId = data.eventId ?? `pur_${order.order_number}`;
  const eventTime = Math.floor(Date.now() / 1000);
  const results: Record<string, any> = {};

  const phoneHashes = normalizePhoneHashes(order.customer_phone);
  const nameHashes = normalizeNameHashes(order.customer_name);
  const cityHash = order.area === "inside_dhaka" ? [sha256("dhaka")] : undefined;
  const fallbackUa =
    data.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  // Facebook CAPI
  const fb: any = pick("facebook");
  if (fb?.pixel_id && fb?.access_token) {
    const pixelId = fb.pixel_id.trim();
    const accessToken = fb.access_token.trim();
    const testCode = fb.test_event_code?.trim() || "";

    const payload: any = {
      data: [
        {
          event_name: "Purchase",
          event_time: eventTime,
          event_id: eventId,
          event_source_url: checkoutUrl,
          action_source: "website",
          user_data: {
            client_user_agent: fallbackUa,
            fbp: data.fbp || undefined,
            fbc: data.fbc || undefined,
            ph: phoneHashes,
            fn: nameHashes.fn,
            ln: nameHashes.ln,
            external_id: [sha256(order.id)],
            country: [sha256("bd")],
            ct: cityHash,
          },
          custom_data: {
            currency: "BDT",
            value: Number(order.total),
            order_id: order.order_number,
            content_type: "product",
            content_ids: orderItems.map((i: any) => String(i.product_id)),
            contents: orderItems.map((i: any) => ({
              id: String(i.product_id),
              quantity: Number(i.quantity),
              item_price: Number(i.reseller_price),
            })),
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const queryParams = new URLSearchParams();
      queryParams.set("access_token", accessToken);
      if (testCode) queryParams.set("test_event_code", testCode);

      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(pixelId)}/events?${queryParams.toString()}`;
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI Facebook Purchase]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.facebook = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI Facebook Purchase Error]", err);
      results.facebook = { ok: false, error: err.message };
    }
  } else {
    results.facebook = { ok: false, reason: "Missing Facebook pixel_id or access_token" };
  }

  // TikTok Events API
  const tt: any = pick("tiktok");
  if (tt?.pixel_id && tt?.access_token) {
    const pixelId = tt.pixel_id.trim();
    const accessToken = tt.access_token.trim();
    const testCode = tt.test_event_code?.trim() || "";

    const payload: any = {
      event_source: "web",
      event_source_id: pixelId,
      data: [
        {
          event: "CompletePayment",
          event_time: eventTime,
          event_id: eventId,
          user: {
            ttp: data.ttp || undefined,
            phone: phoneHashes?.[0] || undefined,
          },
          context: {
            page: { url: checkoutUrl },
            user_agent: fallbackUa,
          },
          properties: {
            currency: "BDT",
            value: Number(order.total),
            order_id: order.order_number,
            contents: orderItems.map((i: any) => ({
              content_id: String(i.product_id),
              quantity: Number(i.quantity),
              price: Number(i.reseller_price),
              content_name: i.product_name,
            })),
          },
        },
      ],
    };

    if (testCode) payload.test_event_code = testCode;

    try {
      const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": accessToken,
        },
        body: JSON.stringify(payload),
      });
      const resBody = await r.json().catch(() => ({}));
      console.log("[CAPI TikTok Purchase]", { ok: r.ok, status: r.status, response: resBody, testCode, pixelId });
      results.tiktok = { ok: r.ok, status: r.status, response: resBody, pixelId, testCode };
    } catch (err: any) {
      console.error("[CAPI TikTok Purchase Error]", err);
      results.tiktok = { ok: false, error: err.message };
    }
  }

  return { ok: true, results };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5. Get active store marketing pixels directly from server
 * ────────────────────────────────────────────────────────────────────────── */
export async function getStoreMarketingPixelsServerImpl(data: { code: string }) {
  const supabaseAdmin = null;
  const { pick } = await getConfigsForStore(supabaseAdmin, data.code);
  const fb = pick("facebook");
  const tt = pick("tiktok");
  const ga = pick("ga4");
  return {
    fb_pixel: fb?.pixel_id?.trim() || null,
    tiktok_pixel: tt?.pixel_id?.trim() || null,
    ga4_id: ga?.pixel_id?.trim() || null,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 6. Get public order details for Thanks page (bypassing anon RLS restriction)
 * ────────────────────────────────────────────────────────────────────────── */
export async function getPublicOrderDetailsServerImpl(data: { orderNumber: string }) {
  const supabaseAdmin = null;
  const { data: od, error } = await publicDb().rpc("capi_order" as any, { p_order_number: data.orderNumber } as any);
  const order: any = od;
  if (error || !order) return null;
  return {
    id: order.id,
    order_number: order.order_number,
    total: Number(order.total),
    delivery_charge: order.shipping_cost ? Number(order.shipping_cost) : null,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    address_line: order.address_line,
    area: order.area,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    created_at: order.created_at,
    reseller_id: order.reseller_id,
    order_items: (order.order_items || []).map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      reseller_price: Number(i.reseller_price),
      quantity: Number(i.quantity),
      variant_label: null,
    })),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dispatcher: custom domains (Cloudflare) have no privileged key, so the
 * call is forwarded once to the platform origin (/api/public/capi).
 * ────────────────────────────────────────────────────────────────────────── */
const CAPI_IMPLS = {
  trackPageViewServer: trackPageViewServerImpl,
  trackViewContentServer: trackViewContentServerImpl,
  trackInitiateCheckoutServer: trackInitiateCheckoutServerImpl,
  trackPurchaseServer: trackPurchaseServerImpl,
  getStoreMarketingPixelsServer: getStoreMarketingPixelsServerImpl,
  getPublicOrderDetailsServer: getPublicOrderDetailsServerImpl,
};

export async function runCapiLocal(name: string, data: any): Promise<any> {
  const impl = (CAPI_IMPLS as Record<string, (d: any) => Promise<any>>)[name];
  if (!impl) throw new Error("Unknown CAPI op");
  return impl(data);
}
