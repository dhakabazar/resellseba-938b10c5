CREATE OR REPLACE FUNCTION public.cf_config_get()
 RETURNS cloudflare_config
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.cloudflare_config;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_any_permission(auth.uid(), ARRAY['settings.manage','domains.manage'])
    OR public.current_reseller_id() IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO r FROM public.cloudflare_config WHERE id = 1;
  RETURN r;
END $function$;
REVOKE EXECUTE ON FUNCTION public.cf_config_get() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cf_config_get() TO authenticated;