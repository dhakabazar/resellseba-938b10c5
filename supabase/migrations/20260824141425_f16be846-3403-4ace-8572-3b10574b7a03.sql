
REVOKE EXECUTE ON FUNCTION public.reseller_can_note(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.order_visible_to_me(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reseller_can_note(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.order_visible_to_me(uuid) TO authenticated, service_role;
