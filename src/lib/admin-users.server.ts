// Server-only helpers for admin user server functions.
export async function assertAdmin(supabase: any, userId: string) {
  const { data: isAdmin, error } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (error) {
    console.error("Error checking admin status:", error);
    // If RPC fails, fallback to manual check
    const { data: userRole } = await supabase.from('user_roles').select('role').eq('user_id', userId).single();
    if (userRole?.role === 'super_admin') return true;
    throw new Response("Forbidden", { status: 403 });
  }
  if (!isAdmin) throw new Response("Forbidden", { status: 403 });
}
