-- Grant access to generate_product_code so authenticated users (Admins) can insert products
GRANT EXECUTE ON FUNCTION public.generate_product_code() TO authenticated, service_role;

-- Fix other revoked functions that are needed for normal operations
GRANT EXECUTE ON FUNCTION public.generate_reseller_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_charge(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_reseller_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
