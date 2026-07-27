import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({ userId: z.string().uuid() });

export const confirmUserEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: got, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr || !got?.user) throw new Response("User not found", { status: 404 });

    if (got.user.email_confirmed_at) {
      return { ok: true, alreadyConfirmed: true, email: got.user.email };
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email_confirm: true,
    });
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true, alreadyConfirmed: false, email: got.user.email };
  });
