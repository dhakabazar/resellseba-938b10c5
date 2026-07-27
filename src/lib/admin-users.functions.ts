import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ userId: z.string().uuid() });

async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}

export const confirmUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const users: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 });
      if (error) break;
      users.push(...(data?.users ?? []));
      if (!data?.users || data.users.length < 100) break;
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });


