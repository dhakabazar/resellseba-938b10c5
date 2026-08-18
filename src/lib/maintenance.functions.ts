import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CleanupStat = { key: string; rows: number };

/** How many junk rows are currently sitting in the database. */
export const cleanupStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CleanupStat[]> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
    const { CLEANUP_TARGETS, countTarget } = await import("@/lib/maintenance.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: CleanupStat[] = [];
    for (const t of CLEANUP_TARGETS) out.push({ key: t.key, rows: await countTarget(supabaseAdmin, t.key) });
    return out;
  });

/** Delete the selected junk data. */
export const runCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { keys: string[] }) => input)
  .handler(async ({ data, context }): Promise<CleanupStat[]> => {
    const { assertAnyPermission } = await import("@/lib/admin-users.server");
    await assertAnyPermission(context.supabase, context.userId, ["settings.manage"]);
    const { CLEANUP_TARGETS, purgeTarget } = await import("@/lib/maintenance.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = new Set(CLEANUP_TARGETS.map((t) => t.key));
    const out: CleanupStat[] = [];
    for (const key of data.keys) {
      if (!allowed.has(key)) continue;
      out.push({ key, rows: await purgeTarget(supabaseAdmin, key) });
    }
    return out;
  });
