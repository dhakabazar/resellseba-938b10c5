import { createFileRoute } from "@tanstack/react-router";

/**
 * Steadfast delivery-status webhook.
 *
 * Configure this URL in the Steadfast merchant panel:
 *   https://<your-domain>/api/public/courier/steadfast?token=<webhook_token>
 *
 * The token must match `webhook_token` saved in Couriers → Steadfast settings.
 * Steadfast posts JSON like:
 *   { notification_type, consignment_id, invoice, cod_amount, status,
 *     delivery_charge, updated_at }
 */
export const Route = createFileRoute("/api/public/courier/steadfast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyCourierUpdate } = await import("@/lib/couriers.server");

        const url = new URL(request.url);
        const provided =
          url.searchParams.get("token") ??
          request.headers.get("x-steadfast-token") ??
          request.headers.get("steadfast-webhook-token") ??
          "";

        const { data: cfg } = await supabaseAdmin
          .from("courier_configs")
          .select("config")
          .eq("provider", "steadfast")
          .maybeSingle();
        const expected = String((cfg?.config as any)?.webhook_token ?? "");
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ status: 401, message: "Invalid token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const raw = await request.text();
        let payload: any;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          return new Response(JSON.stringify({ status: 400, message: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const events = Array.isArray(payload) ? payload : payload ? [payload] : [];
        if (events.length === 0) {
          return new Response(JSON.stringify({ status: 400, message: "Empty payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        let matched = 0;
        for (const e of events) {
          const status = e?.status ?? e?.delivery_status;
          if (!status) continue;
          const res = await applyCourierUpdate(supabaseAdmin, {
            consignmentId: e.consignment_id != null ? String(e.consignment_id) : null,
            trackingCode: e.tracking_code ?? null,
            invoice: e.invoice ?? null,
            courierStatus: String(status),
            source: "webhook",
            notificationType: e.notification_type ?? null,
            codAmount: e.cod_amount != null ? Number(e.cod_amount) : null,
            deliveryCharge: e.delivery_charge != null ? Number(e.delivery_charge) : null,
            note: e.note ?? null,
            payload: e,
          });
          if (res.matched) matched += 1;
        }

        return new Response(JSON.stringify({ status: 200, message: "processed", matched }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(JSON.stringify({ status: 200, message: "Steadfast webhook endpoint" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
