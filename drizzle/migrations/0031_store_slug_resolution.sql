CREATE OR REPLACE FUNCTION public.resolve_store_code(_input text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := trim(coalesce(_input,'')); k text; r text;
BEGIN
  IF v = '' THEN RETURN _input; END IF;
  SELECT code INTO r FROM resellers WHERE code = v LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT code INTO r FROM resellers WHERE lower(code) = lower(v) LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  k := regexp_replace(lower(v), '[^a-z0-9]+', '', 'g');
  IF k = '' THEN RETURN _input; END IF;
  SELECT code INTO r FROM resellers WHERE status='active'
    AND regexp_replace(lower(business_name), '[^a-z0-9]+', '', 'g') = k
    ORDER BY created_at LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT x.code INTO r FROM reseller_settings s JOIN resellers x ON x.id = s.reseller_id
    WHERE x.status='active' AND regexp_replace(lower(s.store_name), '[^a-z0-9]+', '', 'g') = k
    ORDER BY x.created_at LIMIT 1;
  RETURN coalesce(r, _input);
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_store_code(text) TO anon, authenticated, service_role;

DO $do$
DECLARE f record; def text; inj text;
BEGIN
  FOR f IN SELECT p.oid, p.proname FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
    AND p.proname IN ('store_bootstrap','create_public_order','log_store_visit','capi_store_configs') LOOP
    def := pg_get_functiondef(f.oid);
    IF position('resolve_store_code' in def) > 0 THEN CONTINUE; END IF;
    inj := CASE f.proname
      WHEN 'store_bootstrap' THEN '_code := public.resolve_store_code(_code);'
      WHEN 'log_store_visit' THEN '_code := public.resolve_store_code(_code);'
      WHEN 'create_public_order' THEN '_reseller_code := public.resolve_store_code(_reseller_code);'
      ELSE 'IF c !~ ''^[0-9a-f]{8}-'' THEN c := lower(public.resolve_store_code(c)); END IF;' END;
    def := regexp_replace(def, '\mbegin\M', E'BEGIN\n  ' || inj, 'i');
    EXECUTE def;
  END LOOP;
END $do$;