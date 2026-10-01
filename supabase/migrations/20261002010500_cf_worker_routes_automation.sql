-- Migration: Worker route automation for Cloudflare custom domains

ALTER TABLE public.reseller_domains
  ADD COLUMN IF NOT EXISTS worker_route_id TEXT;

ALTER TABLE public.cloudflare_config
  ADD COLUMN IF NOT EXISTS auto_worker_routes BOOLEAN NOT NULL DEFAULT true;

-- Ensure auto_worker_routes and auto_worker_domain are active by default
UPDATE public.cloudflare_config 
SET auto_worker_routes = true,
    auto_worker_domain = true
WHERE id = 1;

-- Clean replacement for cf_config_save
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
  _mode text DEFAULT 'both'::text,
  _server_a_ip text DEFAULT ''::text,
  _server_cname text DEFAULT ''::text,
  _server_note text DEFAULT ''::text,
  _dns_active boolean DEFAULT false
)
RETURNS public.cloudflare_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.cloudflare_config;
DECLARE v_auto boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage','domains.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  v_auto := COALESCE(_auto_worker_domain, true);

  INSERT INTO public.cloudflare_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  UPDATE public.cloudflare_config SET
    api_token = COALESCE(NULLIF(_api_token, ''), api_token),
    account_id = NULLIF(_account_id, ''),
    zone_id = NULLIF(_zone_id, ''),
    zone_name = NULLIF(lower(_zone_name), ''),
    worker_name = NULLIF(_worker_name, ''),
    cname_target = NULLIF(lower(_cname_target), ''),
    a_record_ip = NULLIF(_a_record_ip, ''),
    auto_worker_domain = v_auto,
    auto_worker_routes = v_auto,
    is_active = COALESCE(_is_active, true),
    mode = CASE WHEN _mode IN ('cloudflare','dns','both') THEN _mode ELSE 'both' END,
    server_a_ip = NULLIF(_server_a_ip, ''),
    server_cname = NULLIF(lower(_server_cname), ''),
    server_note = NULLIF(_server_note, ''),
    dns_active = COALESCE(_dns_active, false),
    updated_at = now()
  WHERE id = 1
  RETURNING * INTO r;
  RETURN r;
END $function$;

REVOKE ALL ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean,text,text,text,text,boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.cf_config_save(text,text,text,text,text,text,text,boolean,boolean,text,text,text,text,boolean) TO authenticated;
