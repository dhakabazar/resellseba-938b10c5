import { createFileRoute } from "@tanstack/react-router";

/**
 * Single return endpoint every automatic gateway is pointed at.
 * Gateways may GET or form-POST here, so both verbs are handled and the final
 * hop back to the app is an HTML redirect (a 302 breaks POST returns).
 *
 * Nothing in the query string is trusted: the outcome is always re-verified
 * against the gateway API before anything is marked paid.
 *
 * Two kinds of payments come back here:
 * - `k=order` (default) → a storefront order
 * - `k=deposit`         → a reseller security deposit
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

  const ref = params.on ?? params.tran_id ?? params.order_id ?? "";
  const origin = core.siteOrigin();
  // The payment may have started on any live domain (a platform custom domain,
  // a reseller domain, the published site). Targets signed when the payment was
  // created are trusted as-is; anything else falls back to host validation, so
  // nobody can inject an outside redirect.
  const signed = await core.verifyTargets(params.su, params.cu, params.sig);
  const success = signed ? params.su! : await core.resolveReturnTarget(params.su, origin);
  const cancel = signed ? params.cu! : await core.resolveReturnTarget(params.cu, success);
  const flag = gatewayByProvider(provider)?.returnFlag ?? provider;


  if (!ref) return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));

  if (params.k === "deposit") {
    try {
      const intent = await core.loadDepositIntent(ref);
      if (!intent) return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));
      if (intent.status === "approved") return core.htmlRedirect(core.appendFlag(success, flag, "paid"));
      if (params.t === "cancel") return core.htmlRedirect(core.appendFlag(cancel, flag, "cancelled"));

      const creds = await core.getPlatformCredentials(provider);
      if (!creds) return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));
      const pseudo = core.depositAsOrder(intent);
      const v = await adapterFor(provider).verifyReturn(creds, pseudo, params);
      const outcome = await core.settleDeposit({
        intent,
        provider,
        paid: v.paid,
        amount: v.amount,
        txnId: v.txnId,
      });
      const ok = outcome === "paid" || outcome === "already";
      const status = ok ? "paid" : v.cancelled ? "cancelled" : "failed";
      return core.htmlRedirect(core.appendFlag(ok ? success : cancel, flag, status, v.txnId));
    } catch {
      return core.htmlRedirect(core.appendFlag(cancel, flag, "failed"));
    }
  }

  try {
    const order = await core.loadOrder(ref);
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
      owner: creds.owner,
    });
    const status =
      outcome === "paid" || outcome === "already"
        ? "paid"
        : outcome === "partial"
          ? "partial"
          : v.cancelled
            ? "cancelled"
            : "failed";
    const target = status === "failed" || status === "cancelled" ? cancel : success;
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
