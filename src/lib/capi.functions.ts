import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomUUID } from "crypto";

const input = z.object({
  orderNumber: z.string().min(1),
  code: z.string().min(1),
  eventId: z.string().optional(),
});

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");

/**
 * Server-side purchase tracking: fires Facebook CAPI + TikTok Events API
 * using per-reseller marketing_configs. Public (no auth) but only accepts
 * a real order_number and derives all values server-side, so it cannot be
 * spammed with fake totals.
 */
export const trackPurchaseServer = createServerFn({ method: "POST" })
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total, customer_phone, customer_name, reseller_id, order_items(product_id,product_name,reseller_price,quantity)")
      .eq("order_number", data.orderNumber)
      .maybeSingle();
    if (!order) return { ok: false };

    // marketing_configs: per-reseller override else global (reseller_id null)
    const { data: configs } = await supabaseAdmin
      .from("marketing_configs")
      .select("platform, pixel_id, access_token, test_event_code, is_active, reseller_id")
      .in("platform", ["facebook", "tiktok"])
      .or(`reseller_id.eq.${order.reseller_id},reseller_id.is.null`);

    const pick = (platform: string) => {
      const rows = (configs ?? []).filter((c: any) => c.platform === platform && c.is_active);
      return rows.find((c: any) => c.reseller_id === order.reseller_id) ?? rows.find((c: any) => c.reseller_id === null);
    };

    const eventId = data.eventId ?? `purchase_${order.id}`;
    const eventTime = Math.floor(Date.now() / 1000);
    const results: Record<string, any> = {};

    const fb: any = pick("facebook");
    if (fb?.pixel_id && fb?.access_token) {
      const payload = {
        data: [{
          event_name: "Purchase",
          event_time: eventTime,
          event_id: eventId,
          event_source_url: `https://${data.code}.lovable.app/s/${data.code}/checkout`,
          client_user_agent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
          action_source: "website",
          user_data: {
            ph: order.customer_phone ? [sha256(order.customer_phone)] : undefined,
            fn: order.customer_name ? [sha256(order.customer_name.split(" ")[0])] : undefined,
            external_id: [sha256(order.id)],
          },
          custom_data: {
            currency: "BDT",
            value: Number(order.total),
            order_id: order.order_number,
            contents: (order.order_items ?? []).map((i: any) => ({
              id: i.product_id, quantity: i.quantity, item_price: Number(i.reseller_price),
            })),
          },
        }],
        test_event_code: fb.test_event_code || undefined,
      };
      const url = `https://graph.facebook.com/v18.0/${fb.pixel_id}/events?access_token=${encodeURIComponent(fb.access_token)}`;
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      results.facebook = { ok: r.ok, status: r.status };
    }

    const tt: any = pick("tiktok");
    if (tt?.pixel_id && tt?.access_token) {
      const payload = {
        event_source: "web", event_source_id: tt.pixel_id,
        data: [{
          event: "CompletePayment", event_time: eventTime, event_id: eventId,
          user: { 
            phone: order.customer_phone ? sha256(order.customer_phone) : undefined,
          },
          context: {
            page: { url: `https://${data.code}.lovable.app/s/${data.code}/checkout` },
            ad: { callback: undefined } // TikTok Click ID can be added here if captured in URL
          },
          properties: {
            currency: "BDT", value: Number(order.total), order_id: order.order_number,
            contents: (order.order_items ?? []).map((i: any) => ({
              content_id: i.product_id, quantity: i.quantity, price: Number(i.reseller_price), content_name: i.product_name,
            })),
          },
        }],
        test_event_code: tt.test_event_code || undefined,
      };
      const r = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Access-Token": tt.access_token },
        body: JSON.stringify(payload),
      });
      results.tiktok = { ok: r.ok, status: r.status };
    }

    return { ok: true, results };
  });
