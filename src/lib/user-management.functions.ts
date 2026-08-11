import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-users.server";

const createUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.string(), // Changed to string to support UUIDs or enum values
});


export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create the auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (authError) throw new Response(authError.message, { status: 400 });
    if (!authUser.user) throw new Response("Failed to create user", { status: 500 });

    // 2. Assign role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUser.user.id, role: data.role });

    if (roleError) {
      // Cleanup if role assignment fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Response(roleError.message, { status: 400 });
    }

    return { ok: true, userId: authUser.user.id };
  });

const updatePasswordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6),
});

export const updateAdminUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updatePasswordInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });

    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });

const updateRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(["super_admin", "staff", "reseller", "leader"]),
});

export const updateAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Delete existing roles first to maintain the simple 1-role per user model requested
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });

    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
