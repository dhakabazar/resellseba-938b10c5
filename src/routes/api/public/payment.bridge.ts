import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Payment bridge.
 *
 * Reseller storefronts and brand domains run through Cloudflare, where the
 * privileged backend key is not injected. Those requests forward their payment
 * step here, to the platform origin, which does have it.
 *
 * Security:
 * - Order start/verify accept only an order number and derive every amount
 *   server-side, exactly like the public server functions they replace.
 * - Deposit start requires a valid signed-in bearer token, which is validated
 *   here before anything is written.
 * - No credentials are ever returned to the caller.
 */
const Body = z.object({
  op: z.enum(["order-start", "order-verify", "deposit-start", "list-store", "list-deposit"]),
  origin: z.string().url().optional(),
  orderNumber: z.string().min(3).optional(),
  code: z.string().min(1).optional(),
  provider: z.string().min(2).optional(),
  amount: z.number().positive().max(10_000_000).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function userFromBearer(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { createClient } = await import("@supabase/supabase-js");
  const { getRuntimeEnv } = await import("@/lib/env-bridge");
  const url = getRuntimeEnv("SUPABASE_URL");
  const key = getRuntimeEnv("SUPABASE_PUBLISHABLE_KEY") ?? getRuntimeEnv("SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
}

async function handle(request: Request): Promise<Response> {
  let input: z.infer<typeof Body>;
  try {
    input = Body.parse(await request.json());
  } catch {
    return json({ error: "Invalid request" }, 400);
  }

  const flows = await import("@/lib/gateways/flows.server");

  try {
    switch (input.op) {
      case "list-store":
        if (!input.code) return json({ error: "Missing store code" }, 400);
        return json(await flows.listStoreGatewaysFlow({ code: input.code }));
      case "list-deposit": {
        const userId = await userFromBearer(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);
        return json(await flows.listDepositGatewaysFlow());
      }
      case "order-start":
        if (!input.orderNumber || !input.code || !input.provider)
          return json({ error: "Invalid request" }, 400);
        return json(
          await flows.startOrderPaymentFlow({
            orderNumber: input.orderNumber,
            code: input.code,
            provider: input.provider,
            storeOrigin: input.origin,
          }),
        );
      case "order-verify":
        if (!input.orderNumber) return json({ error: "Invalid request" }, 400);
        return json(await flows.verifyOrderPaymentFlow({ orderNumber: input.orderNumber }));
      case "deposit-start": {
        const userId = await userFromBearer(request);
        if (!userId) return json({ error: "Unauthorized" }, 401);
        if (!input.provider || !input.amount) return json({ error: "Invalid request" }, 400);
        return json(
          await flows.startDepositFlow({
            userId,
            provider: input.provider,
            amount: input.amount,
            storeOrigin: input.origin,
          }),
        );
      }
    }
  } catch (err) {
    if (err instanceof Response) {
      const text = await err.text();
      return json({ error: text || "Payment failed" }, err.status || 500);
    }
    return json({ error: err instanceof Error ? err.message : "Payment failed" }, 500);
  }
}

export const Route = createFileRoute("/api/public/payment/bridge")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
