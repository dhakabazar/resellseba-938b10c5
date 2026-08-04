import { createFileRoute } from "@tanstack/react-router";

/**
 * Carrybee webhook receiver.
 *
 * Configure in Carrybee merchant panel → Webhook Integration:
 *   https://<your-domain>/api/public/courier/carrybee
 *   Secret: the "Webhook Secret" saved in Couriers → Carrybee settings
 *
 * Requirements handled here:
 *  - integration/handshake request returns 202 and echoes back
 *    `X-CB-Webhook-Integration-Header` with the exact secret value.
 *  - `X-Carrybee-Webhook-Signature` is verified (HMAC-SHA256 of the raw body
 *    with the shared secret) when Carrybee sends it.
 */

const INTEGRATION_HEADER = "x-cb-webhook-integration-header";
const SIGNATURE_HEADER = "x-carrybee-webhook-signature";

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/courier/carrybee")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { applyCourierUpdate } = await import("@/lib/couriers.server");

        const { data: cfg } = await supabaseAdmin
          .from("courier_configs")
          .select("config")
          .eq("provider", "carrybee")
          .maybeSingle();
        const secret = String((cfg?.config as any)?.webhook_secret ?? "");
        if (!secret) return json({ error: true, message: "Webhook secret not configured" }, 401);

        const integrationSecret = request.headers.get(INTEGRATION_HEADER) ?? "";
        const raw = await request.text();

        // Handshake / integration verification: echo the secret back with 202.
        if (integrationSecret) {
          if (integrationSecret !== secret)
            return json({ error: true, message: "Invalid integration secret" }, 401);
          return json({ error: false, message: "Webhook integrated" }, 202, {
            "X-CB-Webhook-Integration-Header": secret,
          });
        }

        const signature = (request.headers.get(SIGNATURE_HEADER) ?? "").trim().replace(/^sha256=/, "");
        if (signature) {
          const expected = await hmacHex(secret, raw);
          if (signature.toLowerCase() !== expected.toLowerCase())
            return json({ error: true, message: "Invalid signature" }, 401);
        } else {
          const url = new URL(request.url);
          if ((url.searchParams.get("token") ?? "") !== secret)
            return json({ error: true, message: "Unauthorized" }, 401);
        }

        let payload: any;
        try {
          payload = raw ? JSON.parse(raw) : null;
        } catch {
          return json({ error: true, message: "Invalid JSON" }, 400);
        }
        const events = Array.isArray(payload) ? payload : payload ? [payload] : [];
        if (events.length === 0) return json({ error: true, message: "Empty payload" }, 400);

        let matched = 0;
        for (const e of events) {
          const event = e?.event;
          if (!event) continue;
          const note =
            [e.reason, e.remarks, e.agent_name ? `Agent: ${e.agent_name} ${e.agent_phone ?? ""}` : null]
              .filter(Boolean)
              .join(" · ") || null;
          const res = await applyCourierUpdate(supabaseAdmin, {
            provider: "carrybee",
            consignmentId: e.consignment_id != null ? String(e.consignment_id) : null,
            trackingCode: e.consignment_id != null ? String(e.consignment_id) : null,
            invoice: e.merchant_order_id ?? null,
            courierStatus: String(event),
            source: "webhook",
            notificationType: String(event),
            codAmount:
              e.collected_amount != null
                ? Number(e.collected_amount)
                : e.collectable_amount != null
                  ? Number(e.collectable_amount)
                  : null,
            deliveryCharge: e.delivery_fee != null ? Number(e.delivery_fee) : null,
            note,
            payload: e,
          });
          if (res.matched) matched += 1;
        }

        return json({ error: false, message: "processed", matched }, 200);
      },
      GET: async () => json({ error: false, message: "Carrybee webhook endpoint" }, 200),
    },
  },
});
