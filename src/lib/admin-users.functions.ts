import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAnyPermission, assertPermission } from "@/lib/admin-users.server";

const input = z.object({ userId: z.string().uuid() });

export const confirmUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "resellers.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: got, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !got?.user) throw new Response("User not found", { status: 404 });
    if (got.user.email_confirmed_at) return { ok: true, alreadyConfirmed: true, email: got.user.email };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { email_confirm: true });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, alreadyConfirmed: false, email: got.user.email };
  });

export type EmailStatus = {
  user_id: string;
  email: string | null;
  email_confirmed: boolean;
};

export const listResellerEmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailStatus[]> => {
    await assertPermission(context.supabase, context.userId, "resellers.manage");
    // Auth emails need the privileged key. If it is unavailable in this
    // deployment, return an empty list instead of breaking the whole page.
    const users: any[] = [];
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) break;
        users.push(...(data?.users ?? []));
        if (!data?.users || data.users.length < 100) break;
      }
    } catch (err) {
      console.error("[resellers] email status unavailable", err);
      return [];
    }
    return users.map((u) => ({
      user_id: u.id,
      email: u.email ?? null,
      email_confirmed: !!u.email_confirmed_at,
    }));
  });

export const deleteAuthUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAnyPermission(context.supabase, context.userId, ["staff.manage", "resellers.manage"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });


export type StaffUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  custom_role_id: string | null;
  custom_role_name: string | null;
  created_at: string | null;
};

/** Lists only admin/staff accounts (never resellers) with their assigned custom role. */
export const listStaffUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffUser[]> => {
    await assertPermission(context.supabase, context.userId, "staff.manage");
    // Read through the caller's RLS-scoped client: the service-role key is not
    // available in every deployment environment, and this page must still work.
    const db = context.supabase;

    const { data: roleRows, error: roleErr } = await db
      .from("user_roles")
      .select("user_id, role, custom_role_id, roles:custom_role_id (name)")
      .in("role", ["super_admin", "staff"]);
    if (roleErr) throw new Response(roleErr.message, { status: 400 });

    const ids = (roleRows ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [];

    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, created_at")
      .in("id", ids);

    // Emails live in the auth schema and need the privileged key. Best effort:
    // if it is unavailable, the list still renders without email addresses.
    const emails: Record<string, string | null> = {};
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
        if (error) break;
        for (const u of data?.users ?? []) emails[u.id] = u.email ?? null;
        if (!data?.users || data.users.length < 100) break;
      }
    } catch (err) {
      console.error("[staff] email lookup unavailable", err);
    }

    const profileMap: Record<string, any> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    return (roleRows ?? []).map((r: any) => ({
      id: r.user_id,
      email: emails[r.user_id] ?? null,
      full_name: profileMap[r.user_id]?.full_name ?? null,
      role: r.role,
      custom_role_id: r.custom_role_id ?? null,
      custom_role_name: r.roles?.name ?? null,
      created_at: profileMap[r.user_id]?.created_at ?? null,
    }));
  });
