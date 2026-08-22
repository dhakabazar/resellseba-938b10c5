// Account (auth) lookups and mutations that used to require the privileged
// service-role key. That key is not available in every deployment, so every
// operation goes through SECURITY DEFINER database functions instead, which
// enforce the caller's staff/reseller management permission in SQL.
export type AuthUserRow = {
  user_id: string;
  email: string | null;
  email_confirmed: boolean;
  created_at: string | null;
};

/** All accounts with email + confirmation status (permission checked in SQL). */
export async function loadAuthUsers(supabase: any): Promise<AuthUserRow[]> {
  const { data, error } = await supabase.rpc("admin_auth_users");
  if (error) {
    console.error("[auth-admin] admin_auth_users failed", error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    email: r.email ?? null,
    email_confirmed: !!r.email_confirmed,
    created_at: r.created_at ?? null,
  }));
}

export async function loadAuthEmails(supabase: any): Promise<Record<string, string | null>> {
  const rows = await loadAuthUsers(supabase);
  return Object.fromEntries(rows.map((r) => [r.user_id, r.email]));
}

function fail(error: { message: string }): never {
  const message = error.message.replace(/^.*?(?:ERROR|error):\s*/i, "");
  throw new Response(message || "Request failed", {
    status: /forbidden|not signed in/i.test(message) ? 403 : 400,
  });
}

export async function confirmEmail(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("admin_confirm_user_email", { _user_id: userId });
  if (error) fail(error);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    email: (row?.email as string | null) ?? null,
    alreadyConfirmed: !!row?.already_confirmed,
  };
}

export async function setPassword(supabase: any, userId: string, password: string) {
  const { error } = await supabase.rpc("admin_set_user_password", {
    _user_id: userId,
    _password: password,
  });
  if (error) fail(error);
}

export async function assignRole(
  supabase: any,
  userId: string,
  role: string,
  customRoleId: string | null,
) {
  const { error } = await supabase.rpc("admin_assign_role", {
    _user_id: userId,
    _role: role,
    _custom_role_id: customRoleId,
  });
  if (error) fail(error);
}

export async function createStaffUser(
  supabase: any,
  input: { email: string; password: string; fullName: string; role: string; customRoleId: string | null },
) {
  const { data, error } = await supabase.rpc("admin_create_staff_user", {
    _email: input.email,
    _password: input.password,
    _full_name: input.fullName,
    _role: input.role,
    _custom_role_id: input.customRoleId,
  });
  if (error) fail(error);
  return data as string;
}

export async function deleteUser(supabase: any, userId: string) {
  const { error } = await supabase.rpc("admin_delete_user", { _user_id: userId });
  if (error) fail(error);
}

/** Splits a role selection that may be a system role name or a custom role UUID. */
export function splitRoleSelection(role: string): { role: string; customRoleId: string | null } {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(role);
  if (isUuid) return { role: "staff", customRoleId: role };
  return { role: role || "staff", customRoleId: null };
}
