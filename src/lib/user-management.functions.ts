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

const updateUserInput = z.object({
  userId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  role: z.string().optional().or(z.literal("")),
  password: z.string().min(6).max(72).optional().or(z.literal("")),
});

/** Edits every field of a staff account, optionally setting a brand-new password. */
export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => updateUserInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertPermission(context.supabase, context.userId, "staff.manage");
    const { updateUser, splitRoleSelection } = await import("@/lib/auth-admin.server");
    const selection = data.role ? splitRoleSelection(data.role) : null;
    await updateUser(context.supabase, {
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      phone: data.phone ?? "",
      role: selection?.role ?? null,
      customRoleId: selection?.customRoleId ?? null,
      password: data.password || null,
    });
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
