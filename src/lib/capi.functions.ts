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

// Helper to get active marketing configs for a store code / reseller id / domain
async function getConfigsForStore(supabaseAdmin: any, codeOrResellerId: string) {
  const clean = (codeOrResellerId || "").trim();
  let resellerId: string | null = null;

  if (clean) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);
    if (isUuid) {
      resellerId = clean;
    } else {
      // 1. Check if code matches reseller code directly
      const { data: rByCode } = await supabaseAdmin
        .from("resellers")
        .select("id")
        .ilike("code", clean)
        .maybeSingle();

      if (rByCode?.id) {
        resellerId = rByCode.id;
      }

      // 2. Check if clean matches custom domain or hostname
      if (!resellerId) {
        const cleanHost = clean
          .replace(/^https?:\/\//, "")
          .replace(/\/.*$/, "")
          .replace(/^www\./, "")
          .toLowerCase();

        const { data: domainRows } = await supabaseAdmin
          .from("reseller_domains")
          .select("reseller_id, hostname");

        const matchedDomain = (domainRows ?? []).find((d: any) => {
          const h = (d.hostname || "")
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\/.*$/, "")
            .replace(/^www\./, "");
          return h === cleanHost || cleanHost.includes(h) || h.includes(cleanHost);
        });

        if (matchedDomain?.reseller_id) {
          resellerId = matchedDomain.reseller_id;
        }
      }
    }
  }

  // 3. Fetch marketing configs safely
  const configs: any[] = [];
  try {
    if (resellerId) {
      const { data: rConfigs, error: rErr } = await supabaseAdmin
        .from("marketing_configs")
        .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
        .eq("reseller_id", resellerId);

      if (rErr) console.error("[getConfigsForStore] Reseller query error:", rErr.message);
      if (rConfigs && rConfigs.length > 0) configs.push(...rConfigs);
    }

    const { data: gConfigs, error: gErr } = await supabaseAdmin
      .from("marketing_configs")
      .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
      .is("reseller_id", null);

    if (gErr) console.error("[getConfigsForStore] Global query error:", gErr.message);
    if (gConfigs && gConfigs.length > 0) configs.push(...gConfigs);
  } catch (err: any) {
    console.error("[getConfigsForStore] Fetch error:", err?.message);
  }

  const pick = (platform: string) => {
    // Reseller row
    const resellerRow = resellerId
      ? configs.find(
          (c: any) => c.reseller_id === resellerId && c.platform === platform && c.is_active !== false,
        )
      : null;

    // Global row
    const globalRow = configs.find(
      (c: any) => !c.reseller_id && c.platform === platform && c.is_active !== false,
    );

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
      is_active: resellerRow ? resellerRow.is_active !== false : globalRow?.is_active !== false,
    };
  };

  return { pick, resellerId, configs };
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
              content_ids: [String(data.productId)],
              content_type: "product",
              contents: [{ id: String(data.productId), quantity: 1, item_price: Number(data.price) }],
            },
          },
        ],
      };

      if (testCode) payload.test_event_code = testCode;
      payload.access_token = accessToken;

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
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook ViewContent Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
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
              user_agent: data.userAgent || undefined,
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
    }),
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
      payload.access_token = accessToken;

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
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook InitiateCheckout Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
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
              user_agent: data.userAgent || undefined,
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
    const rawOrderNumber = data.orderNumber.trim();
    const cleanOrderNumber = rawOrderNumber.replace(/^#/, "").trim();

    // 1. Retrieve order details safely without breaking URL fragments
    let order: any = null;
    const { data: o1 } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, customer_phone, customer_name, address_line, area, reseller_id")
      .eq("order_number", cleanOrderNumber)
      .maybeSingle();

    if (o1) {
      order = o1;
    } else {
      const { data: o2 } = await supabaseAdmin
        .from("orders")
        .select("id, order_number, total, customer_phone, customer_name, address_line, area, reseller_id")
        .ilike("order_number", `%${cleanOrderNumber}%`)
        .limit(1)
        .maybeSingle();
      if (o2) order = o2;
    }

    if (!order) {
      console.warn("[trackPurchaseServer] Order not found for orderNumber:", rawOrderNumber);
      return { ok: false, error: "Order not found" };
    }

    // 2. Retrieve order items
    const { data: items } = await supabaseAdmin
      .from("order_items")
      .select("product_id, product_name, reseller_price, quantity")
      .eq("order_id", order.id);

    const orderItems = items ?? [];

    // 3. Marketing configs using unified resolver with reseller UUID fallback
    const { pick } = await getConfigsForStore(supabaseAdmin, order.reseller_id || data.code || "");

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
      payload.access_token = accessToken;

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
        results.facebook = { ok: r.ok, status: r.status, response: resBody };
      } catch (err: any) {
        console.error("[CAPI Facebook Purchase Error]", err);
        results.facebook = { ok: false, error: err.message };
      }
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
              user_agent: data.userAgent || undefined,
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
