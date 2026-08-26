import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Automatic payment gateway server functions.
 *
 * - startGatewayPayment / verifyGatewayPayment are public: they only accept an
 *   order number and derive every amount server-side, so nothing can be tampered.
 * - testGatewayConnection is admin-only.
 */

export const startGatewayPayment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ orderNumber: z.string().min(3), code: z.string().min(1), provider: z.string().min(2) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { adapterFor } = await import("@/lib/gateways/adapters.server");
    const core = await import("@/lib/gateways/core.server");
    const { extractGatewayError } = await import("@/lib/gateways/registry");

    const order = await core.loadOrder(data.orderNumber);
    if (order.payment_status === "paid") throw new Response("This order is already paid", { status: 400 });
    const creds = await core.getCredentials(data.provider, order.reseller_id);
    if (!creds) throw new Response("This payment gateway is not available", { status: 400 });

    const origin = core.siteOrigin();
    const spa = core.spaUrls(origin, data.code, order.order_number);
    const params = { on: order.order_number, su: spa.success, cu: spa.cancel, code: data.code };
    const urls = {
      returnUrl: core.returnUrl(origin, data.provider, { ...params, t: "success" }),
      failUrl: core.returnUrl(origin, data.provider, { ...params, t: "fail" }),
      cancelUrl: core.returnUrl(origin, data.provider, { ...params, t: "cancel" }),
      ipnUrl:
        data.provider === "sslcommerz"
          ? `${origin}/api/public/payment/sslcommerz-ipn`
          : data.provider === "epayseba"
            ? `${origin}/api/public/payment/epayseba-webhook`
            : core.returnUrl(origin, data.provider, { ...params, t: "ipn" }),
    };


    try {
      const res = await adapterFor(data.provider).create(creds, order, urls);
      const db = await core.admin();
      await db
        .from("orders")
        .update({ payment_provider: data.provider, transaction_id: res.ref || order.transaction_id || null })
        .eq("id", order.id);
      return { redirectUrl: res.paymentUrl };
    } catch (err) {
      throw new Response(extractGatewayError(err), { status: 502 });
    }
  });

/** Called by the storefront success page after the browser comes back. */
export const verifyGatewayPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderNumber: z.string().min(3) }).parse(d))
  .handler(async ({ data }) => {
    const { adapterFor } = await import("@/lib/gateways/adapters.server");
    const core = await import("@/lib/gateways/core.server");

    const order = await core.loadOrder(data.orderNumber);
    if (order.payment_status === "paid")
      return { status: "paid" as const, amount: Number(order.paid_amount ?? order.total) };
    const provider = order.payment_provider;
    if (!provider) return { status: "unpaid" as const, amount: 0 };
    const creds = await core.getCredentials(provider, order.reseller_id);
    if (!creds) return { status: "unpaid" as const, amount: 0 };
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
      return {
        status: outcome === "already" ? ("paid" as const) : (outcome as "paid" | "partial" | "unpaid"),
        amount: v.amount,
      };
    } catch {
      return { status: "unpaid" as const, amount: 0 };
    }
  });

export const testGatewayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.string().min(2),
        api_key: z.string().optional(),
        api_secret: z.string().optional(),
        merchant_id: z.string().optional(),
        config: z.record(z.string(), z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { adapterFor } = await import("@/lib/gateways/adapters.server");
    const { credsFromRaw } = await import("@/lib/gateways/core.server");
    const { extractGatewayError } = await import("@/lib/gateways/registry");
    try {
      await adapterFor(data.provider).test(credsFromRaw(data.provider, data));
      return { success: true as const };
    } catch (err) {
      return { success: false as const, error: extractGatewayError(err) };
    }
  });

/** Public: which automatic gateways a storefront may show (no credentials leak). */
export const listActiveGateways = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ code: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const core = await import("@/lib/gateways/core.server");
    const { GATEWAYS } = await import("@/lib/gateways/registry");
    const db = await core.admin();
    const { data: reseller } = await db
      .from("resellers")
      .select("id")
      .eq("code", data.code)
      .maybeSingle();
    const resellerId = (reseller?.id as string | undefined) ?? null;
    const { data: rows } = await db
      .from("payment_gateway_configs")
      .select("provider,label,is_active,reseller_id")
      .eq("is_active", true);
    const out: { provider: string; label: string; method: string }[] = [];
    for (const spec of GATEWAYS) {
      const matches = (rows ?? []).filter((r: any) => r.provider === spec.provider);
      const row =
        matches.find((r: any) => resellerId && r.reseller_id === resellerId) ??
        matches.find((r: any) => r.reseller_id === null);
      if (row) out.push({ provider: spec.provider, label: (row as any).label || spec.label, method: spec.method });
    }
    return out;
  });

/** Reseller: which automatic gateways the admin keeps active for deposits. */
export const listDepositGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const core = await import("@/lib/gateways/core.server");
    const { GATEWAYS } = await import("@/lib/gateways/registry");
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
  });

/**
 * Reseller: start an online security-deposit payment.
 * The amount is taken from the request, but the payment is only credited after
 * the gateway itself confirms it on the return endpoint.
 */
export const startDepositPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ provider: z.string().min(2), amount: z.number().positive().max(10_000_000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { adapterFor } = await import("@/lib/gateways/adapters.server");
    const core = await import("@/lib/gateways/core.server");
    const { extractGatewayError } = await import("@/lib/gateways/registry");

    const { data: reseller } = await context.supabase
      .from("resellers")
      .select("id,business_name,contact_phone")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!reseller) throw new Response("Reseller account not found", { status: 400 });

    const creds = await core.getPlatformCredentials(data.provider);
    if (!creds) throw new Response("This payment gateway is not available", { status: 400 });

    // Uses the caller's own (RLS-scoped) client so starting a payment never
    // depends on elevated server credentials.
    const db = context.supabase;
    const code = core.newDepositCode();
    const { data: intentRow, error } = await db
      .from("deposit_requests")
      .insert({
        reseller_id: reseller.id,
        amount: data.amount,
        code,
        provider: data.provider,
        method: data.provider,
        status: "pending",
        note: "Online payment (awaiting gateway confirmation)",
      })
      .select("id,code,reseller_id,amount,status,provider,txn_id")
      .single();
    if (error || !intentRow) throw new Response("Could not start the payment", { status: 500 });

    const origin = core.siteOrigin();
    const back = `${origin}/reseller`;
    const params = { on: code, su: back, cu: back, k: "deposit", code };
    const urls = {
      returnUrl: core.returnUrl(origin, data.provider, { ...params, t: "success" }),
      failUrl: core.returnUrl(origin, data.provider, { ...params, t: "fail" }),
      cancelUrl: core.returnUrl(origin, data.provider, { ...params, t: "cancel" }),
      ipnUrl:
        data.provider === "sslcommerz"
          ? `${origin}/api/public/payment/sslcommerz-ipn`
          : data.provider === "epayseba"
            ? `${origin}/api/public/payment/epayseba-webhook`
            : core.returnUrl(origin, data.provider, { ...params, t: "ipn" }),
    };


    const pseudo = core.depositAsOrder(intentRow as any, {
      name: reseller.business_name ?? undefined,
      phone: reseller.contact_phone ?? undefined,
    });
    try {
      const res = await adapterFor(data.provider).create(creds, pseudo, urls);
      await db.from("deposit_requests").update({ txn_id: res.ref || null }).eq("id", intentRow.id);
      return { redirectUrl: res.paymentUrl, code };
    } catch (err) {
      await db.from("deposit_requests").delete().eq("id", intentRow.id);
      throw new Response(extractGatewayError(err), { status: 502 });
    }
  });
