// Server-only authorization helpers. The database remains the source of truth.
export async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

export async function assertPermission(supabase: any, userId: string, permission: string) {
  const { data, error } = await supabase.rpc("has_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}

export async function assertAnyPermission(supabase: any, userId: string, permissions: string[]) {
  const { data, error } = await supabase.rpc("has_any_permission", {
    _user_id: userId,
    _permissions: permissions,
  });
  if (error || !data) throw new Response("Forbidden", { status: 403 });
}
