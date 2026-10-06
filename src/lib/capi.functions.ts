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

// Helper to get active marketing configs for a store code
async function getConfigsForStore(supabaseAdmin: any, code: string) {
  const { data: store } = await supabaseAdmin
    .from("resellers")
    .select("id")
    .eq("code", code)
    .maybeSingle();

  const resellerId = store?.id || null;

  const { data: configs } = await supabaseAdmin
    .from("marketing_configs")
    .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
    .in("platform", ["facebook", "tiktok", "ga4"])
    .or(resellerId ? `reseller_id.eq.${resellerId},reseller_id.is.null` : `reseller_id.is.null`);

  const pick = (platform: string) => {
    const rows = (configs ?? []).filter((c: any) => c.platform === platform && c.is_active);
    return rows.find((c: any) => c.reseller_id === resellerId) ?? rows.find((c: any) => c.reseller_id === null);
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
  price: z.number().positive(),
  eventId: z.string().min(1),
  origin: z.string().url().optional(),
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
      const payload = {
        data: [
          {
            event_name: "ViewContent",
            event_time: eventTime,
            event_id: data.eventId,
            event_source_url: eventUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
              fbp: data.fbp || undefined,
              fbc: data.fbc || undefined,
            },
            custom_data: {
              currency: "BDT",
              value: data.price,
              content_name: data.productName,
              content_ids: [data.productId],
              content_type: "product",
              contents: [{ id: data.productId, quantity: 1, item_price: data.price }],
            },
          },
        ],
        test_event_code: fb.test_event_code || undefined,
      };
      try {
        const url = `https://graph.facebook.com/v19.0/${fb.pixel_id}/events?access_token=${encodeURIComponent(fb.access_token)}`;
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        results.facebook = { ok: r.ok, status: r.status };
      } catch (err: any) {
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload = {
        event_source: "web",
        event_source_id: tt.pixel_id,
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
              value: data.price,
              content_id: data.productId,
              content_name: data.productName,
              content_type: "product",
              contents: [{ content_id: data.productId, content_name: data.productName, quantity: 1, price: data.price }],
            },
          },
        ],
        test_event_code: tt.test_event_code || undefined,
      };
      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Access-Token": tt.access_token },
          body: JSON.stringify(payload),
        });
        results.tiktok = { ok: r.ok, status: r.status };
      } catch (err: any) {
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
      price: z.number(),
      qty: z.number(),
    })
  ),
  total: z.number(),
  eventId: z.string().min(1),
  origin: z.string().url().optional(),
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
      const payload = {
        data: [
          {
            event_name: "InitiateCheckout",
            event_time: eventTime,
            event_id: data.eventId,
            event_source_url: checkoutUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
              fbp: data.fbp || undefined,
              fbc: data.fbc || undefined,
              ph: phoneHashes,
              fn: nameHashes.fn,
              ln: nameHashes.ln,
            },
            custom_data: {
              currency: "BDT",
              value: data.total,
              num_items: data.items.reduce((s, i) => s + i.qty, 0),
              content_type: "product",
              content_ids: data.items.map((i) => i.id),
              contents: data.items.map((i) => ({ id: i.id, quantity: i.qty, item_price: i.price })),
            },
          },
        ],
        test_event_code: fb.test_event_code || undefined,
      };
      try {
        const url = `https://graph.facebook.com/v19.0/${fb.pixel_id}/events?access_token=${encodeURIComponent(fb.access_token)}`;
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        results.facebook = { ok: r.ok, status: r.status };
      } catch (err: any) {
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload = {
        event_source: "web",
        event_source_id: tt.pixel_id,
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
              value: data.total,
              quantity: data.items.reduce((s, i) => s + i.qty, 0),
              contents: data.items.map((i) => ({
                content_id: i.id,
                content_name: i.name,
                quantity: i.qty,
                price: i.price,
              })),
            },
          },
        ],
        test_event_code: tt.test_event_code || undefined,
      };
      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Access-Token": tt.access_token },
          body: JSON.stringify(payload),
        });
        results.tiktok = { ok: r.ok, status: r.status };
      } catch (err: any) {
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
  code: z.string().min(1),
  eventId: z.string().optional(),
  origin: z.string().url().optional(),
  fbp: z.string().optional(),
  fbc: z.string().optional(),
  ttp: z.string().optional(),
  userAgent: z.string().optional(),
});

export const trackPurchaseServer = createServerFn({ method: "POST" })
  .inputValidator((d) => purchaseInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, customer_phone, customer_name, address_line, area, reseller_id, order_items(product_id,product_name,reseller_price,quantity)")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) return { ok: false };

    // marketing_configs: per-reseller override else global (reseller_id null)
    const { data: configs } = await supabaseAdmin
      .from("marketing_configs")
      .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
      .in("platform", ["facebook", "tiktok", "ga4"])
      .or(`reseller_id.eq.${order.reseller_id},reseller_id.is.null`);

    const pick = (platform: string) => {
      const rows = (configs ?? []).filter((c: any) => c.platform === platform && c.is_active);
      return rows.find((c: any) => c.reseller_id === order.reseller_id) ?? rows.find((c: any) => c.reseller_id === null);
    };

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
      const payload = {
        data: [
          {
            event_name: "Purchase",
            event_time: eventTime,
            event_id: eventId,
            event_source_url: checkoutUrl,
            action_source: "website",
            client_user_agent: data.userAgent || undefined,
            user_data: {
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
              content_ids: (order.order_items ?? []).map((i: any) => i.product_id),
              contents: (order.order_items ?? []).map((i: any) => ({
                id: i.product_id,
                quantity: i.quantity,
                item_price: Number(i.reseller_price),
              })),
            },
          },
        ],
        test_event_code: fb.test_event_code || undefined,
      };
      try {
        const url = `https://graph.facebook.com/v19.0/${fb.pixel_id}/events?access_token=${encodeURIComponent(fb.access_token)}`;
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        results.facebook = { ok: r.ok, status: r.status };
      } catch (err: any) {
        results.facebook = { ok: false, error: err.message };
      }
    }

    // TikTok Events API
    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload = {
        event_source: "web",
        event_source_id: tt.pixel_id,
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
              contents: (order.order_items ?? []).map((i: any) => ({
                content_id: i.product_id,
                quantity: i.quantity,
                price: Number(i.reseller_price),
                content_name: i.product_name,
              })),
            },
          },
        ],
        test_event_code: tt.test_event_code || undefined,
      };
      try {
        const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Access-Token": tt.access_token },
          body: JSON.stringify(payload),
        });
        results.tiktok = { ok: r.ok, status: r.status };
      } catch (err: any) {
        results.tiktok = { ok: false, error: err.message };
      }
    }

    return { ok: true, results };
  });
