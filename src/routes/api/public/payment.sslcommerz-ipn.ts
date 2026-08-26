import { createFileRoute } from "@tanstack/react-router";

/**
 * SSLCommerz IPN. Server-to-server, so the payload is never trusted: the
 * transaction is re-validated through the validator API before settling.
 */
async function handle(request: Request): Promise<Response> {
  const core = await import("@/lib/gateways/core.server");
  const { adapterFor } = await import("@/lib/gateways/adapters.server");

  const params: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((v, k) => (params[k] = v));
  if (request.method === "POST") {
    const body = await request.text();
    new URLSearchParams(body).forEach((v, k) => (params[k] = v));
  }

  const orderNumber = params.tran_id ?? params.on ?? "";
  if (!orderNumber) return new Response("missing tran_id", { status: 400 });

  try {
    const order = await core.loadOrder(orderNumber);
    if (order.payment_status === "paid") return new Response("ok");
    const creds = await core.getCredentials("sslcommerz", order.reseller_id);
    if (!creds) return new Response("not configured", { status: 400 });
    const v = await adapterFor("sslcommerz").verifyReturn(creds, order, params);
    await core.settlePayment({ order, provider: "sslcommerz", paid: v.paid, amount: v.amount, txnId: v.txnId });
    return new Response("ok");
  } catch {
    return new Response("error", { status: 200 });
  }
}

export const Route = createFileRoute("/api/public/payment/sslcommerz-ipn")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
