import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission } from "@/lib/admin-users.server";

export type AgentCandidate = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: string;
};

/**
 * Staff / admin accounts that can be turned into commission agents.
 * Emails live in the auth schema, so they need the privileged key; if it is
 * unavailable the list still renders (names only).
 */
export const listAgentCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AgentCandidate[]> => {
    await assertAnyPermission(context.supabase, context.userId, ["agents.manage", "staff.manage"]);
    const db = context.supabase;

    const { data: roleRows, error } = await db
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["super_admin", "staff"]);
    if (error) throw new Response(error.message, { status: 400 });

    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    if (ids.length === 0) return [];

    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", ids);
    const nameMap: Record<string, string | null> = Object.fromEntries(
      (profiles ?? []).map((p: any) => [p.id, p.full_name ?? null]),
    );

    const emails: Record<string, string | null> = {};
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (let page = 1; page <= 10; page++) {
        const { data, error: err } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
        if (err) break;
        for (const u of data?.users ?? []) emails[u.id] = u.email ?? null;
        if (!data?.users || data.users.length < 100) break;
      }
    } catch (err) {
      console.error("[agents] email lookup unavailable", err);
    }

    return ids.map((id) => ({
      user_id: id,
      email: emails[id] ?? null,
      full_name: nameMap[id] ?? null,
      role: (roleRows ?? []).find((r: any) => r.user_id === id)?.role ?? "staff",
    }));
  });
