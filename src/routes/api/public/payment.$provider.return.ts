import { createFileRoute } from "@tanstack/react-router";

/**
 * Single return endpoint every automatic gateway is pointed at.
 * Gateways may GET or form-POST here, so both verbs are handled and the final
 * hop back to the storefront is an HTML redirect (a 302 breaks POST returns).
 *
 * Nothing in the query string is trusted: the outcome is always re-verified
 * against the gateway API before the order is marked paid.
 */
async function handle(request: Request, provider: string): Promise<Response> {
  const core = await import("@/lib/gateways/core.server");
  const { adapterFor } = await import("@/lib/gateways/adapters.server");
  const { gatewayByProvider } = await import("@/lib/gateways/registry");

  const url = new URL(request.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (params[k] = v));
  if (request.method === "POST") {
    const body = await request.text();
    new URLSearchParams(body).forEach((v, k) => (params[k] = v));
  }

  const orderNumber = params.on ?? params.tran_id ?? params.order_id ?? "";
  const success = params.su || core.siteOrigin();
  const cancel = params.cu || success;
  const flag = gatewayByProvider(provider)?.returnFlag ?? provider;

  if (!orderNumber) return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));

  try {
    const order = await core.loadOrder(orderNumber);
    if (order.payment_status === "paid") return core.htmlRedirect(core.appendFlag(success, flag, "paid"));

    if (params.t === "cancel") return core.htmlRedirect(core.appendFlag(cancel, flag, "cancelled"));

    const creds = await core.getCredentials(provider, order.reseller_id);
    if (!creds) return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));

    const v = await adapterFor(provider).verifyReturn(creds, order, params);
    const outcome = await core.settlePayment({
      order,
      provider,
      paid: v.paid,
      amount: v.amount,
      txnId: v.txnId,
    });
    const status =
      outcome === "paid" || outcome === "already"
        ? "paid"
        : outcome === "mismatch"
          ? "mismatch"
          : v.cancelled
            ? "cancelled"
            : "failed";
    const target = status === "paid" ? success : cancel;
    return core.htmlRedirect(core.appendFlag(target, flag, status, v.txnId));
  } catch {
    return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));
  }
}

export const Route = createFileRoute("/api/public/payment/$provider/return")({
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params.provider),
      POST: ({ request, params }) => handle(request, params.provider),
    },
  },
});
