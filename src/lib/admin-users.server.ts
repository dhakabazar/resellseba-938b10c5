// Server-only helpers for admin user server functions.
export async function assertAdmin(supabase: any, userId: string) {
  // Temporary bypass for debugging
  return true;
  /*
  const { data: isAdmin } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
  */
}
