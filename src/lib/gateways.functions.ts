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
          : `${origin}/api/public/payment/epayseba-webhook`,
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
    const provider = (await core.admin())
      ? ((await (await core.admin()).from("orders").select("payment_provider").eq("id", order.id).maybeSingle())
          .data?.payment_provider as string | null)
      : null;
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
      });
      return {
        status: outcome === "already" ? ("paid" as const) : (outcome as "paid" | "mismatch" | "unpaid"),
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
