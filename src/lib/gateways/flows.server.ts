// The privileged half of the automatic payment gateways.
//
// Everything here needs the privileged backend key, so it only ever runs on the
// platform origin: either directly (server function on that origin) or via the
// public bridge route when the request arrived on a custom domain.
import * as core from "./core.server";
import { adapterFor } from "./adapters.server";
import { extractGatewayError } from "./registry";
import { GATEWAYS } from "./registry";
import { platformOrigin } from "./bridge.server";

/** Callback (return/IPN) URLs must land where the privileged key exists. */
async function callbackBase(): Promise<string> {
  const here = core.siteOrigin();
  return await platformOrigin(here);
}

/**
 * The storefront/dashboard origin the person is actually browsing. The browser
 * sends it (the request may have been proxied, so headers can point at the
 * platform host), and it is validated against the hosts we own before use.
 */
async function shopperOrigin(raw?: string): Promise<string> {
  const here = core.siteOrigin();
  if (!raw) return here.replace(/\/+$/, "");
  const ok = await core.resolveReturnTarget(raw, here);
  return ok.replace(/\/+$/, "");
}

function ipnFor(provider: string, origin: string, params: Record<string, string>) {
  if (provider === "sslcommerz") return `${origin}/api/public/payment/sslcommerz-ipn`;
  if (provider === "epayseba") return `${origin}/api/public/payment/epayseba-webhook`;
  return core.returnUrl(origin, provider, { ...params, t: "ipn" });
}

export async function startOrderPaymentFlow(input: {
  orderNumber: string;
  code: string;
  provider: string;
  /** Storefront origin the shopper is browsing (may be a custom domain). */
  storeOrigin?: string;
}): Promise<{ redirectUrl: string }> {
  const order = await core.loadOrder(input.orderNumber);
  if (order.payment_status === "paid") throw new Response("This order is already paid", { status: 400 });
  // The store code must belong to the order's own store, so one storefront can
  // never start (or capture the return of) another store's payment.
  {
    const db = await core.admin();
    const { data: store } = await db.from("resellers").select("id").eq("code", input.code).maybeSingle();
    const storeId = (store?.id as string | undefined) ?? null;
    if ((order.reseller_id ?? null) !== storeId) throw new Response("Order not found", { status: 404 });
  }
  const creds = await core.getCredentials(input.provider, order.reseller_id);
  if (!creds) throw new Response("This payment gateway is not available", { status: 400 });


  const store = await shopperOrigin(input.storeOrigin);
  const cb = await callbackBase();
  const spa = core.spaUrls(store, input.code, order.order_number);
  const params = {
    on: order.order_number,
    su: spa.success,
    cu: spa.cancel,
    code: input.code,
    sig: await core.signTargets(spa.success, spa.cancel),
  };
  const urls = {
    returnUrl: core.returnUrl(cb, input.provider, { ...params, t: "success" }),
    failUrl: core.returnUrl(cb, input.provider, { ...params, t: "fail" }),
    cancelUrl: core.returnUrl(cb, input.provider, { ...params, t: "cancel" }),
    ipnUrl: ipnFor(input.provider, cb, params),
  };

  try {
    const res = await adapterFor(input.provider).create(creds, order, urls);
    const db = await core.admin();
    await db
      .from("orders")
      .update({ payment_provider: input.provider, transaction_id: res.ref || order.transaction_id || null })
      .eq("id", order.id);
    return { redirectUrl: res.paymentUrl };
  } catch (err) {
    throw new Response(extractGatewayError(err), { status: 502 });
  }
}

export async function verifyOrderPaymentFlow(input: { orderNumber: string }): Promise<{
  status: "paid" | "partial" | "unpaid";
  amount: number;
}> {
  const order = await core.loadOrder(input.orderNumber);
  if (order.payment_status === "paid")
    return { status: "paid", amount: Number(order.paid_amount ?? order.total) };
  const provider = order.payment_provider;
  if (!provider) return { status: "unpaid", amount: 0 };
  const creds = await core.getCredentials(provider, order.reseller_id);
  if (!creds) return { status: "unpaid", amount: 0 };
  try {
    const v = await adapterFor(provider).verifyReturn(creds, order, {});
    const outcome = await core.settlePayment({
      order,
      provider,
      paid: v.paid,
      amount: v.amount,
      txnId: v.txnId,
      owner: creds.owner,
    });
    return { status: outcome === "already" ? "paid" : outcome, amount: v.amount };
  } catch {
    return { status: "unpaid", amount: 0 };
  }
}

export async function listStoreGatewaysFlow(input: { code: string }) {
  const db = await core.admin();
  const { data: reseller } = await db.from("resellers").select("id").eq("code", input.code).maybeSingle();
  const resellerId = (reseller?.id as string | undefined) ?? null;
  const { data: rows } = await db
    .from("payment_gateway_configs")
    .select("provider,label,is_active,reseller_id,mode");
  const out: { provider: string; label: string; method: string }[] = [];
  for (const spec of GATEWAYS) {
    const matches = (rows ?? []).filter((r: any) => r.provider === spec.provider);
    const row = core.resolveGatewayRow(matches as any[], resellerId);
    if (row) out.push({ provider: spec.provider, label: (row as any).label || spec.label, method: spec.method });
  }
  return out;
}


export async function listDepositGatewaysFlow() {
  const db = await core.admin();
  const { data: rows } = await db
    .from("payment_gateway_configs")
    .select("provider,label,is_active,reseller_id")
    .is("reseller_id", null)
    .eq("is_active", true);
  const out: { provider: string; label: string }[] = [];
  for (const spec of GATEWAYS) {
    const row = (rows ?? []).find((r: any) => r.provider === spec.provider);
    if (row) out.push({ provider: spec.provider, label: (row as any).label || spec.label });
  }
  return out;
}

/**
 * Starts a reseller security-deposit payment. `userId` is always a verified
 * caller identity (auth middleware on this origin, or a validated bearer token
 * on the bridge route).
 */
export async function startDepositFlow(input: {
  userId: string;
  provider: string;
  amount: number;
  storeOrigin?: string;
}): Promise<{ redirectUrl: string; code: string }> {
  const db = await core.admin();
  const { data: reseller } = await db
    .from("resellers")
    .select("id,business_name,contact_phone")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (!reseller) throw new Response("Reseller account not found", { status: 400 });

  const creds = await core.getPlatformCredentials(input.provider);
  if (!creds) throw new Response("This payment gateway is not available", { status: 400 });

  const code = core.newDepositCode();
  const { data: intentRow, error } = await db
    .from("deposit_requests")
    .insert({
      reseller_id: reseller.id,
      amount: input.amount,
      code,
      provider: input.provider,
      method: input.provider,
      status: "pending",
      note: "Online payment (awaiting gateway confirmation)",
    })
    .select("id,code,reseller_id,amount,status,provider,txn_id")
    .single();
  if (error || !intentRow) throw new Response("Could not start the payment", { status: 500 });

  const store = await shopperOrigin(input.storeOrigin);
  const cb = await callbackBase();
  const back = `${store}/reseller/payouts`;
  const params = { on: code, su: back, cu: back, k: "deposit", code, sig: await core.signTargets(back, back) };
  const urls = {
    returnUrl: core.returnUrl(cb, input.provider, { ...params, t: "success" }),
    failUrl: core.returnUrl(cb, input.provider, { ...params, t: "fail" }),
    cancelUrl: core.returnUrl(cb, input.provider, { ...params, t: "cancel" }),
    ipnUrl: ipnFor(input.provider, cb, params),
  };

  const pseudo = core.depositAsOrder(intentRow as any, {
    name: (reseller as any).business_name ?? undefined,
    phone: (reseller as any).contact_phone ?? undefined,
  });
  try {
    const res = await adapterFor(input.provider).create(creds, pseudo, urls);
    await db.from("deposit_requests").update({ txn_id: res.ref || null }).eq("id", (intentRow as any).id);
    return { redirectUrl: res.paymentUrl, code };
  } catch (err) {
    await db.from("deposit_requests").delete().eq("id", (intentRow as any).id);
    throw new Response(extractGatewayError(err), { status: 502 });
  }
}
