import { createFileRoute } from "@tanstack/react-router";

/**
 * ePaySeba webhook. Signature (when a secret key is configured) is checked
 * first, then the payment is re-verified through the provider API.
 */
export const Route = createFileRoute("/api/public/payment/epayseba-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const core = await import("@/lib/gateways/core.server");
        const { adapterFor } = await import("@/lib/gateways/adapters.server");

        const raw = await request.text();
        let payload: Record<string, any> = {};
        try {
          payload = JSON.parse(raw) as Record<string, any>;
        } catch {
          new URLSearchParams(raw).forEach((v, k) => (payload[k] = v));
        }

        const orderNumber = String(payload.order_id ?? payload.invoice ?? payload.reference ?? "");
        if (!orderNumber) return new Response("missing order id", { status: 400 });

        try {
          const order = await core.loadOrder(orderNumber);
          if (order.payment_status === "paid") return new Response("ok");
          const creds = await core.getCredentials("epayseba", order.reseller_id);
          if (!creds) return new Response("not configured", { status: 400 });

          if (creds.api_secret) {
            const signature =
              request.headers.get("x-epayseba-signature") ?? request.headers.get("x-signature") ?? "";
            const { createHmac, timingSafeEqual } = await import("node:crypto");
            const expected = createHmac("sha256", creds.api_secret).update(raw).digest("hex");
            const ok =
              signature.length === expected.length &&
              timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
            if (!ok) return new Response("invalid signature", { status: 401 });
          }

          const params: Record<string, string> = {};
          for (const [k, v] of Object.entries(payload)) params[k] = String(v ?? "");
          const v = await adapterFor("epayseba").verifyReturn(creds, order, params);
          await core.settlePayment({ order, provider: "epayseba", paid: v.paid, amount: v.amount, txnId: v.txnId });
          return new Response("ok");
        } catch {
          return new Response("error", { status: 200 });
        }
      },
    },
  },
});
