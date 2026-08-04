import { createFileRoute } from "@tanstack/react-router";

/**
 * Pathao webhook receiver.
 *
 * Configure in Pathao merchant panel → Webhook Integration:
 *   https://<your-domain>/api/public/courier/pathao
 *   Secret: the "Webhook Secret" saved in Couriers → Pathao settings
 *
 * Requirements handled here:
 *  - every response echoes `X-Pathao-Merchant-Webhook-Integration-Secret` with
 *    the configured secret (Pathao's integration check requires it),
 *  - `X-PATHAO-Signature` header must match the configured secret,
 *  - responds fast (well within Pathao's 10s limit).
 */

const SIGNATURE_HEADER = "x-pathao-signature";
const INTEGRATION_HEADER = "X-Pathao-Merchant-Webhook-Integration-Secret";

function json(body: unknown, status: number, secret?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { [INTEGRATION_HEADER]: secret } : {}),
    },
  });
}

export const Route = createFileRoute("/api/public/courier/pathao")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyCourierUpdate } = await import("@/lib/couriers.server");

        const { data: cfg } = await supabaseAdmin
          .from("courier_configs")
          .select("config")
          .eq("provider", "pathao")
          .maybeSingle();
        const secret = String((cfg?.config as any)?.webhook_secret ?? "");
        if (!secret) return json({ error: true, message: "Webhook secret not configured" }, 401);

        const signature = (request.headers.get(SIGNATURE_HEADER) ?? "").trim();
        const raw = await request.text();
        const url = new URL(request.url);
        const tokenOk = (url.searchParams.get("token") ?? "") === secret;
        if (signature !== secret && !tokenOk)
          return json({ error: true, message: "Invalid signature" }, 401, secret);

        let payload: any;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          return json({ error: true, message: "Invalid JSON" }, 400, secret);
        }
        const events = Array.isArray(payload) ? payload : payload ? [payload] : [];
        if (events.length === 0) return json({ error: true, message: "Empty payload" }, 400, secret);

        let matched = 0;
        for (const e of events) {
          const event = String(e?.event ?? "");
          // store.* events carry no consignment — nothing to apply to an order
          if (!event || event.startsWith("store.")) continue;
          const note =
            [e.reason, e.return_type ? `Return type: ${e.return_type}` : null, e.invoice_id ? `Invoice: ${e.invoice_id}` : null]
              .filter(Boolean)
              .join(" · ") || null;
          const res = await applyCourierUpdate(supabaseAdmin, {
            provider: "pathao",
            consignmentId: e.consignment_id != null ? String(e.consignment_id) : null,
            trackingCode: e.consignment_id != null ? String(e.consignment_id) : null,
            invoice: e.merchant_order_id ?? null,
            courierStatus: event,
            source: "webhook",
            notificationType: event,
            codAmount: e.collected_amount != null ? Number(e.collected_amount) : null,
            deliveryCharge: e.delivery_fee != null ? Number(e.delivery_fee) : null,
            note,
            payload: e,
          });
          if (res.matched) matched += 1;
        }

        return json({ error: false, message: "processed", matched }, 200, secret);
      },
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: cfg } = await supabaseAdmin
          .from("courier_configs")
          .select("config")
          .eq("provider", "pathao")
          .maybeSingle();
        const secret = String((cfg?.config as any)?.webhook_secret ?? "");
        return json({ error: false, message: "Pathao webhook endpoint" }, 200, secret || undefined);
      },
    },
  },
});
