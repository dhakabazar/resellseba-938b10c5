CREATE OR REPLACE FUNCTION public.cf_config_settings()
RETURNS TABLE(account_id text, zone_id text, zone_name text, worker_name text, cname_target text, a_record_ip text, auto_worker_domain boolean, is_active boolean, has_token boolean, updated_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.account_id, c.zone_id, c.zone_name, c.worker_name, c.cname_target, c.a_record_ip,
         COALESCE(c.auto_worker_domain,false), COALESCE(c.is_active,false),
         c.api_token IS NOT NULL, c.updated_at
  FROM public.cloudflare_config c
  WHERE c.id = 1 AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.cf_config_settings() FROM anon;
GRANT EXECUTE ON FUNCTION public.cf_config_settings() TO authenticated;