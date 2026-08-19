CREATE OR REPLACE FUNCTION public.cf_config_get()
RETURNS public.cloudflare_config
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.cloudflare_config;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO r FROM public.cloudflare_config WHERE id = 1;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.cf_dns_guide()
RETURNS TABLE(cname_target text, a_record_ip text, zone_name text, active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(c.cname_target,''), COALESCE(c.a_record_ip,''), COALESCE(c.zone_name,''),
         (COALESCE(c.is_active,false) AND c.api_token IS NOT NULL AND c.zone_id IS NOT NULL)
  FROM public.cloudflare_config c
  WHERE c.id = 1 AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.cf_config_save(
  _api_token text,
  _account_id text,
  _zone_id text,
  _zone_name text,
  _worker_name text,
  _cname_target text,
  _a_record_ip text,
  _auto_worker_domain boolean,
  _is_active boolean
)
RETURNS public.cloudflare_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.cloudflare_config;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.cloudflare_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  UPDATE public.cloudflare_config SET
    api_token = COALESCE(NULLIF(_api_token, ''), api_token),
    account_id = NULLIF(_account_id, ''),
    zone_id = NULLIF(_zone_id, ''),
    zone_name = NULLIF(lower(_zone_name), ''),
    worker_name = NULLIF(_worker_name, ''),
    cname_target = NULLIF(lower(_cname_target), ''),
    a_record_ip = NULLIF(_a_record_ip, ''),
    auto_worker_domain = COALESCE(_auto_worker_domain, false),
    is_active = COALESCE(_is_active, false),
    updated_at = now()
  WHERE id = 1
  RETURNING * INTO r;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.cf_config_get() FROM anon;
REVOKE ALL ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cf_config_get() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cf_dns_guide() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean) TO authenticated;