ALTER TABLE public.cloudflare_config
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS server_a_ip text,
  ADD COLUMN IF NOT EXISTS server_cname text,
  ADD COLUMN IF NOT EXISTS server_note text,
  ADD COLUMN IF NOT EXISTS dns_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.cloudflare_config DROP CONSTRAINT IF EXISTS cloudflare_config_mode_check;
ALTER TABLE public.cloudflare_config ADD CONSTRAINT cloudflare_config_mode_check CHECK (mode IN ('cloudflare','dns','both'));

ALTER TABLE public.reseller_domains ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'cloudflare';
ALTER TABLE public.reseller_domains DROP CONSTRAINT IF EXISTS reseller_domains_mode_check;
ALTER TABLE public.reseller_domains ADD CONSTRAINT reseller_domains_mode_check CHECK (mode IN ('cloudflare','dns'));

DROP FUNCTION IF EXISTS public.cf_config_settings();
CREATE OR REPLACE FUNCTION public.cf_config_settings()
RETURNS TABLE(account_id text, zone_id text, zone_name text, worker_name text, cname_target text, a_record_ip text, auto_worker_domain boolean, is_active boolean, has_token boolean, updated_at timestamptz, mode text, server_a_ip text, server_cname text, server_note text, dns_active boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.account_id, c.zone_id, c.zone_name, c.worker_name, c.cname_target, c.a_record_ip,
         COALESCE(c.auto_worker_domain,false), COALESCE(c.is_active,false),
         c.api_token IS NOT NULL, c.updated_at,
         COALESCE(c.mode,'both'), c.server_a_ip, c.server_cname, c.server_note,
         COALESCE(c.dns_active,false)
  FROM public.cloudflare_config c
  WHERE c.id = 1 AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.cf_config_settings() FROM anon;
GRANT EXECUTE ON FUNCTION public.cf_config_settings() TO authenticated;

DROP FUNCTION IF EXISTS public.cf_dns_guide();
CREATE OR REPLACE FUNCTION public.cf_dns_guide()
RETURNS TABLE(cname_target text, a_record_ip text, zone_name text, active boolean, mode text, server_a_ip text, server_cname text, server_note text, cf_ready boolean, dns_ready boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(c.cname_target,''), COALESCE(c.a_record_ip,''), COALESCE(c.zone_name,''),
         (
           (COALESCE(c.mode,'both') <> 'dns' AND COALESCE(c.is_active,false) AND c.api_token IS NOT NULL AND c.zone_id IS NOT NULL)
           OR (COALESCE(c.mode,'both') <> 'cloudflare' AND COALESCE(c.dns_active,false) AND (c.server_a_ip IS NOT NULL OR c.server_cname IS NOT NULL))
         ),
         COALESCE(c.mode,'both'), COALESCE(c.server_a_ip,''), COALESCE(c.server_cname,''), COALESCE(c.server_note,''),
         (COALESCE(c.mode,'both') <> 'dns' AND COALESCE(c.is_active,false) AND c.api_token IS NOT NULL AND c.zone_id IS NOT NULL),
         (COALESCE(c.mode,'both') <> 'cloudflare' AND COALESCE(c.dns_active,false) AND (c.server_a_ip IS NOT NULL OR c.server_cname IS NOT NULL))
  FROM public.cloudflare_config c
  WHERE c.id = 1 AND auth.uid() IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.cf_dns_guide() TO authenticated;

DROP FUNCTION IF EXISTS public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean);
CREATE OR REPLACE FUNCTION public.cf_config_save(
  _api_token text,
  _account_id text,
  _zone_id text,
  _zone_name text,
  _worker_name text,
  _cname_target text,
  _a_record_ip text,
  _auto_worker_domain boolean,
  _is_active boolean,
  _mode text DEFAULT 'both',
  _server_a_ip text DEFAULT '',
  _server_cname text DEFAULT '',
  _server_note text DEFAULT '',
  _dns_active boolean DEFAULT false
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
    mode = CASE WHEN _mode IN ('cloudflare','dns','both') THEN _mode ELSE 'both' END,
    server_a_ip = NULLIF(_server_a_ip, ''),
    server_cname = NULLIF(lower(_server_cname), ''),
    server_note = NULLIF(_server_note, ''),
    dns_active = COALESCE(_dns_active, false),
    updated_at = now()
  WHERE id = 1
  RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean,text,text,text,text,boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean,text,text,text,text,boolean) TO authenticated;