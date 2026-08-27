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
    z
      .object({
        orderNumber: z.string().min(3),
        code: z.string().min(1),
        provider: z.string().min(2),
        storeOrigin: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const bridge = await import("@/lib/gateways/bridge.server");
    if (!bridge.hasPrivilegedDb()) {
      return await bridge.forwardToPlatform<{ redirectUrl: string }>("order-start", {
        ...data,
        origin: data.storeOrigin,
      });
    }
    const flows = await import("@/lib/gateways/flows.server");
    return await flows.startOrderPaymentFlow(data);
  });

/** Called by the storefront success page after the browser comes back. */
export const verifyGatewayPayment = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ orderNumber: z.string().min(3) }).parse(d))
  .handler(async ({ data }) => {
    const bridge = await import("@/lib/gateways/bridge.server");
    if (!bridge.hasPrivilegedDb()) {
      return await bridge.forwardToPlatform<{ status: "paid" | "partial" | "unpaid"; amount: number }>(
        "order-verify",
        data,
      );
    }
    const flows = await import("@/lib/gateways/flows.server");
    return await flows.verifyOrderPaymentFlow(data);
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
    // Resellers may test the credentials of their own gateway setups.
    const { data: resellerId } = isAdmin ? { data: null } : await context.supabase.rpc("current_reseller_id");
    if (!isAdmin && !resellerId) throw new Response("Forbidden", { status: 403 });


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
    const bridge = await import("@/lib/gateways/bridge.server");
    if (!bridge.hasPrivilegedDb()) {
      return await bridge.forwardToPlatform<{ provider: string; label: string; method: string }[]>(
        "list-store",
        data,
      );
    }
    const flows = await import("@/lib/gateways/flows.server");
    return await flows.listStoreGatewaysFlow(data);
  });

/** Reseller: which automatic gateways the admin keeps active for deposits. */
export const listDepositGateways = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const bridge = await import("@/lib/gateways/bridge.server");
    if (!bridge.hasPrivilegedDb()) {
      return await bridge.forwardToPlatform<{ provider: string; label: string }[]>(
        "list-deposit",
        {},
        bridge.incomingAuthorization(),
      );
    }
    const flows = await import("@/lib/gateways/flows.server");
    return await flows.listDepositGatewaysFlow();
  });

/**
 * Reseller: start an online security-deposit payment.
 * The amount is taken from the request, but the payment is only credited after
 * the gateway itself confirms it on the return endpoint.
 */
export const startDepositPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        provider: z.string().min(2),
        amount: z.number().positive().max(10_000_000),
        storeOrigin: z.string().url().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const bridge = await import("@/lib/gateways/bridge.server");
    if (!bridge.hasPrivilegedDb()) {
      return await bridge.forwardToPlatform<{ redirectUrl: string; code: string }>(
        "deposit-start",
        { ...data, origin: data.storeOrigin },
        bridge.incomingAuthorization(),
      );
    }
    const flows = await import("@/lib/gateways/flows.server");
    return await flows.startDepositFlow({ ...data, userId: context.userId });
  });
