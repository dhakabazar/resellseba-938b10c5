import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/admin-users.server";

const input = z.object({ userId: z.string().uuid() });

/** Sets an easy, readable password for a reseller and returns it once to the admin. */
export const resetResellerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "resellers.manage");
    const { setPassword } = await import("@/lib/auth-admin.server");
    const { easyPassword } = await import("@/lib/reseller-access.server");
    const password = easyPassword();
    await setPassword(context.supabase, data.userId, password);
    return { ok: true, password };
  });

/**
 * Mints a one-time magic-link token for the reseller account so an admin can
 * enter the reseller panel. Requires reseller management permission.
 */
export const impersonateReseller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "resellers.manage");
    const { mintImpersonationToken } = await import("@/lib/reseller-access.server");
    return mintImpersonationToken(data.userId);
  });
