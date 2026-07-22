
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
-- RLS helpers (has_role, is_super_admin, current_reseller_id) must remain executable
-- by anon/authenticated because they are called inside RLS policies during normal reads.
