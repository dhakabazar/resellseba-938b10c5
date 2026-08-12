import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-users.server";

export const getRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("roles")
      .select(`
        *,
        role_permissions (
          permission_id
        )
      `);
    if (error) throw new Response(error.message, { status: 400 });
    return data;
  });

export const getPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("permissions").select("*");
    if (error) throw new Response(error.message, { status: 400 });
    return data;
  });

const saveRoleInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()),
});

export const saveRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => saveRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let roleId = data.id;

    if (roleId) {
      const { error } = await supabaseAdmin
        .from("roles")
        .update({ name: data.name, description: data.description })
        .eq("id", roleId);
      if (error) throw new Response(error.message, { status: 400 });
    } else {
      const { data: newRole, error } = await supabaseAdmin
        .from("roles")
        .insert({ name: data.name, description: data.description })
        .select("id")
        .single();
      if (error) throw new Response(error.message, { status: 400 });
      roleId = newRole.id;
    }

    // Sync permissions
    await supabaseAdmin.from("role_permissions").delete().eq("role_id", roleId);
    if (data.permissionIds.length > 0) {
      const { error: permError } = await supabaseAdmin
        .from("role_permissions")
        .insert(data.permissionIds.map(pid => ({ role_id: roleId, permission_id: pid })));
      if (permError) throw new Response(permError.message, { status: 400 });
    }

    return { ok: true, id: roleId };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("roles").delete().eq("id", data.id).eq("is_system", false);
    if (error) throw new Response(error.message, { status: 400 });
    return { ok: true };
  });
