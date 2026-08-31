REVOKE EXECUTE ON FUNCTION public.subscription_config() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_price(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_options(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_until(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_locked(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_state(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_overview(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_apply(uuid, text, integer, numeric, text, text, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_request_review(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_subscription_extend(uuid, text, integer, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_subscription_save(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_subscription_gate() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_request_price() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_trial_on_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_reseller_admin_fields() FROM anon, authenticated;
-- store gate is read by the public storefront
GRANT EXECUTE ON FUNCTION public.subscription_store_allowed(uuid) TO anon, authenticated;