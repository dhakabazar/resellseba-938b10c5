import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPermission } from "@/lib/admin-users.server";

const createUserInput = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  role: z.string(), // system role name or custom role UUID
});

export const createAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "staff.manage");
    const { createStaffUser, splitRoleSelection } = await import("@/lib/auth-admin.server");
    const { role, customRoleId } = splitRoleSelection(data.role);
    const userId = await createStaffUser(context.supabase, {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      role,
      customRoleId,
    });
    return { ok: true, userId };
  });

const updatePasswordInput = z.object({
  userId: z.string().uuid(),
  password: z.string().min(6),
});

export const updateAdminUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updatePasswordInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "staff.manage");
    const { setPassword } = await import("@/lib/auth-admin.server");
    await setPassword(context.supabase, data.userId, data.password);
    return { ok: true };
  });

const updateRoleInput = z.object({
  userId: z.string().uuid(),
  role: z.string(),
});

export const updateAdminUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateRoleInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "staff.manage");
    const { assignRole, splitRoleSelection } = await import("@/lib/auth-admin.server");
    const { role, customRoleId } = splitRoleSelection(data.role);
    await assignRole(context.supabase, data.userId, role, customRoleId);
    return { ok: true };
  });
