import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

function normalizePhoneHashes(rawPhone?: string | null): string[] | undefined {
  if (!rawPhone) return undefined;
  const digits = rawPhone.replace(/\D/g, "");
  if (!digits) return undefined;
  const hashes = new Set<string>();
  hashes.add(sha256(digits));
  if (digits.startsWith("01")) {
    hashes.add(sha256(`88${digits}`));
    hashes.add(sha256(`+88${digits}`));
  } else if (digits.startsWith("8801")) {
    hashes.add(sha256(digits));
    hashes.add(sha256(`+${digits}`));
    hashes.add(sha256(digits.replace(/^88/, "")));
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

// Helper to get active marketing configs for a store code (reseller override > global)
async function getConfigsForStore(supabaseAdmin: any, code: string) {
  const cleanCode = (code || "").trim();
  let store: { id: string; code?: string } | null = null;

  // 1. Check if code matches reseller code directly
  if (cleanCode) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);
    if (isUuid) {
      const { data } = await supabaseAdmin.from("resellers").select("id, code").eq("id", cleanCode).maybeSingle();
      if (data?.id) store = data;
    }
    if (!store?.id) {
      const { data } = await supabaseAdmin.from("resellers").select("id, code").ilike("code", cleanCode).maybeSingle();
      if (data?.id) store = data;
    }
  }

  // 2. If not found by code, try matching custom domain or hostname
  if (!store?.id && cleanCode) {
    const cleanHost = cleanCode.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const { data: domainRow } = await supabaseAdmin
      .from("reseller_domains")
      .select("reseller_id")
      .or(`hostname.ilike.${cleanHost},hostname.ilike.www.${cleanHost}`)
      .limit(1)
      .maybeSingle();

    if (domainRow?.reseller_id) {
      store = { id: domainRow.reseller_id, code: cleanCode };
    }
  }

  const resellerId = store?.id || null;

  // 3. Fetch marketing configs for this reseller + platform global configs
  const { data: configs } = await supabaseAdmin
    .from("marketing_configs")
    .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
    .in("platform", ["facebook", "tiktok", "ga4"])
    .or(resellerId ? `reseller_id.eq.${resellerId},reseller_id.is.null` : `reseller_id.is.null`);

  const pick = (platform: string) => {
    // Check reseller-specific config first
    if (resellerId) {
      const resellerRow = (configs ?? []).find(
        (c: any) =>
          c.reseller_id === resellerId &&
          c.platform === platform &&
          (c.is_active !== false) &&
          (c.pixel_id?.trim() || c.access_token?.trim())
      );
      if (resellerRow) return resellerRow;
    }

    // Fallback to platform global config
    const globalRow = (configs ?? []).find(
      (c: any) => !c.reseller_id && c.platform === platform && c.is_active
    );
    return globalRow ?? null;
  };

  return { pick, resellerId };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 1. Server-side ViewContent CAPI
 * ────────────────────────────────────────────────────────────────────────── */
const viewContentInput = z.object({
  code: z.string().min(1),
  productId: z.string().min(1),
  productName: z.string().min(1),
  price: z.coerce.number(),
  eventId: z.string().min(1),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});

export const trackViewContentServer = createServerFn({ method: "POST" })
  .inputValidator((d) => viewContentInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pick } = await getConfigsForStore(supabaseAdmin, data.code);

    const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
    const eventUrl = origin || undefined;
    const eventTime = Math.floor(Date.now() / 1000);
    const results: Record<string, any> = {};

    // Facebook CAPI
    const fb: any = pick("facebook");
    if (fb?.pixel_id && fb?.access_token) {
      const payload: any = {
        data: [
          {
            event_name: "ViewContent",
            event_time: eventTime,
            event_id: data.eventId,
            event_source_url: eventUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
              client_user_agent: data.userAgent || undefined,
              fbp: data.fbp || undefined,
              fbc: data.fbc || undefined,
              country: [sha256("bd")],
            },
            custom_data: {
              currency: "BDT",
              value: Number(data.price),
              content_name: data.productName,
              content_ids: [data.productId],
              content_type: "product",
              contents: [{ id: data.productId, quantity: 1, item_price: Number(data.price) }],
            },
          },
        ],
      };
      if (fb.test_event_code?.trim()) {
        payload.test_event_code = fb.test_event_code.trim();
      }

      try {
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(fb.pixel_id.trim())}/events?access_token=${encodeURIComponent(fb.access_token.trim())}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI Facebook ViewContent]", { ok: r.ok, status: r.status, response: resBody, testCode: fb.test_event_code });
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook ViewContent Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload: any = {
        event_source: "web",
        event_source_id: tt.pixel_id.trim(),
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
              user_agent: data.userAgent || undefined,
            },
            properties: {
              currency: "BDT",
              value: Number(data.price),
              content_id: data.productId,
              content_name: data.productName,
              content_type: "product",
              contents: [{ content_id: data.productId, content_name: data.productName, quantity: 1, price: Number(data.price) }],
            },
          },
        ],
      };
      if (tt.test_event_code?.trim()) {
        payload.test_event_code = tt.test_event_code.trim();
      }

      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": tt.access_token.trim(),
          },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI TikTok ViewContent]", { ok: r.ok, status: r.status, response: resBody, testCode: tt.test_event_code });
        results.tiktok = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI TikTok ViewContent Error]", err);
        results.tiktok = { ok: false, error: err.message };
      }
    }

    return { ok: true, results };
  });

/* ──────────────────────────────────────────────────────────────────────────
 * 2. Server-side InitiateCheckout CAPI
 * ────────────────────────────────────────────────────────────────────────── */
const initiateCheckoutInput = z.object({
  code: z.string().min(1),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.coerce.number(),
      qty: z.coerce.number(),
    })
  ),
  total: z.coerce.number(),
  eventId: z.string().min(1),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
});

export const trackInitiateCheckoutServer = createServerFn({ method: "POST" })
  .inputValidator((d) => initiateCheckoutInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pick } = await getConfigsForStore(supabaseAdmin, data.code);

    const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
    const checkoutUrl = origin ? `${origin}/checkout` : undefined;
    const eventTime = Math.floor(Date.now() / 1000);
    const results: Record<string, any> = {};

    const phoneHashes = normalizePhoneHashes(data.customerPhone);
    const nameHashes = normalizeNameHashes(data.customerName);

    // Facebook CAPI
    const fb: any = pick("facebook");
    if (fb?.pixel_id && fb?.access_token) {
      const payload: any = {
        data: [
          {
            event_name: "InitiateCheckout",
            event_time: eventTime,
            event_id: data.eventId,
            event_source_url: checkoutUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
              client_user_agent: data.userAgent || undefined,
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
              content_ids: data.items.map((i) => i.id),
              contents: data.items.map((i) => ({ id: i.id, quantity: i.qty, item_price: Number(i.price) })),
            },
          },
        ],
      };
      if (fb.test_event_code?.trim()) {
        payload.test_event_code = fb.test_event_code.trim();
      }

      try {
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(fb.pixel_id.trim())}/events?access_token=${encodeURIComponent(fb.access_token.trim())}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI Facebook InitiateCheckout]", { ok: r.ok, status: r.status, response: resBody, testCode: fb.test_event_code });
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook InitiateCheckout Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload: any = {
        event_source: "web",
        event_source_id: tt.pixel_id.trim(),
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
              user_agent: data.userAgent || undefined,
            },
            properties: {
              currency: "BDT",
              value: Number(data.total),
              quantity: data.items.reduce((s, i) => s + i.qty, 0),
              contents: data.items.map((i) => ({
                content_id: i.id,
                content_name: i.name,
                quantity: i.qty,
                price: Number(i.price),
              })),
            },
          },
        ],
      };
      if (tt.test_event_code?.trim()) {
        payload.test_event_code = tt.test_event_code.trim();
      }

      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": tt.access_token.trim(),
          },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI TikTok InitiateCheckout]", { ok: r.ok, status: r.status, response: resBody, testCode: tt.test_event_code });
        results.tiktok = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI TikTok InitiateCheckout Error]", err);
        results.tiktok = { ok: false, error: err.message };
      }
    }

    return { ok: true, results };
  });

/* ──────────────────────────────────────────────────────────────────────────
 * 3. Server-side Purchase CAPI
 * ────────────────────────────────────────────────────────────────────────── */
const purchaseInput = z.object({
  orderNumber: z.string().min(1),
  code: z.string().optional(),
  eventId: z.string().optional(),
  origin: z.string().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});

export const trackPurchaseServer = createServerFn({ method: "POST" })
  .inputValidator((d) => purchaseInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Retrieve order details
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, customer_phone, customer_name, address_line, area, reseller_id")
      .eq("order_number", data.orderNumber)
      .maybeSingle();

    if (!order) return { ok: false, error: "Order not found" };

    // 2. Retrieve order items
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_id, product_name, reseller_price, quantity")
      .eq("order_id", order.id);

    const orderItems = items ?? [];

    // 3. Marketing configs using unified resolver
    const { pick } = await getConfigsForStore(supabaseAdmin, data.code || order.reseller_id || "");

    const origin = (data.origin ?? process.env["SITE_URL"] ?? "").replace(/\/$/, "");
    const checkoutUrl = origin ? `${origin}/thanks?n=${encodeURIComponent(order.order_number)}` : undefined;

    const eventId = data.eventId ?? `pur_${order.order_number}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const results: Record<string, any> = {};

    const phoneHashes = normalizePhoneHashes(order.customer_phone);
    const nameHashes = normalizeNameHashes(order.customer_name);

    // Facebook CAPI
    const fb: any = pick("facebook");
    if (fb?.pixel_id && fb?.access_token) {
      const payload: any = {
        data: [
          {
            event_name: "Purchase",
            event_time: eventTime,
            event_id: eventId,
            event_source_url: checkoutUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
              client_user_agent: data.userAgent || undefined,
              fbp: data.fbp || undefined,
              fbc: data.fbc || undefined,
              ph: phoneHashes,
              fn: nameHashes.fn,
              ln: nameHashes.ln,
              external_id: [sha256(order.id)],
              country: [sha256("bd")],
              ct: order.area ? [sha256(order.area)] : undefined,
            },
            custom_data: {
              currency: "BDT",
              value: Number(order.total),
              order_id: order.order_number,
              content_type: "product",
              content_ids: orderItems.map((i: any) => i.product_id),
              contents: orderItems.map((i: any) => ({
                id: i.product_id,
                quantity: i.quantity,
                item_price: Number(i.reseller_price),
              })),
            },
          },
        ],
      };
      if (fb.test_event_code?.trim()) {
        payload.test_event_code = fb.test_event_code.trim();
      }

      try {
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(fb.pixel_id.trim())}/events?access_token=${encodeURIComponent(fb.access_token.trim())}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI Facebook Purchase]", { ok: r.ok, status: r.status, response: resBody, testCode: fb.test_event_code });
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook Purchase Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload: any = {
        event_source: "web",
        event_source_id: tt.pixel_id.trim(),
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
              user_agent: data.userAgent || undefined,
            },
            properties: {
              currency: "BDT",
              value: Number(order.total),
              order_id: order.order_number,
              contents: orderItems.map((i: any) => ({
                content_id: i.product_id,
                quantity: i.quantity,
                price: Number(i.reseller_price),
                content_name: i.product_name,
              })),
            },
          },
        ],
      };
      if (tt.test_event_code?.trim()) {
        payload.test_event_code = tt.test_event_code.trim();
      }

      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Access-Token": tt.access_token.trim(),
          },
          body: JSON.stringify(payload),
        });
        const resBody = await r.json().catch(() => ({}));
        console.log("[CAPI TikTok Purchase]", { ok: r.ok, status: r.status, response: resBody, testCode: tt.test_event_code });
        results.tiktok = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI TikTok Purchase Error]", err);
        results.tiktok = { ok: false, error: err.message };
      }
    }

    return { ok: true, results };
  });

/* ──────────────────────────────────────────────────────────────────────────
 * 4. Get active store marketing pixels directly from server
 * ────────────────────────────────────────────────────────────────────────── */
export const getStoreMarketingPixelsServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pick } = await getConfigsForStore(supabaseAdmin, data.code);
    const fb = pick("facebook");
    const tt = pick("tiktok");
    const ga = pick("ga4");
    return {
      fb_pixel: fb?.pixel_id?.trim() || null,
      tiktok_pixel: tt?.pixel_id?.trim() || null,
      ga4_id: ga?.pixel_id?.trim() || null,
    };
  });

/* ──────────────────────────────────────────────────────────────────────────
 * 5. Get public order details for Thanks page (bypassing anon RLS restriction)
 * ────────────────────────────────────────────────────────────────────────── */
export const getPublicOrderDetailsServer = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ orderNumber: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, shipping_cost, customer_name, customer_phone, address_line, area, payment_method, payment_status, created_at, reseller_id, order_items(id, product_id, product_name, reseller_price, quantity, variant_label)")
      .eq("order_number", data.orderNumber)
      .maybeSingle();

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
        variant_label: i.variant_label,
      })),
    };
  });
