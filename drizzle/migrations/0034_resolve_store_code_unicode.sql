CREATE OR REPLACE FUNCTION public.store_name_key(_s text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(lower(normalize(coalesce(_s,''), NFC)), '[[:space:][:punct:]|$+<=>^`~]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.resolve_store_code(_input text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := trim(coalesce(_input,'')); k text; r text;
BEGIN
  IF v = '' THEN RETURN _input; END IF;
  SELECT code INTO r FROM resellers WHERE code = v LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT code INTO r FROM resellers WHERE lower(code) = lower(v) LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  k := public.store_name_key(v);
  IF k = '' THEN RETURN _input; END IF;
  SELECT code INTO r FROM resellers WHERE status='active'
    AND public.store_name_key(business_name) = k
    ORDER BY created_at LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT x.code INTO r FROM reseller_settings s JOIN resellers x ON x.id = s.reseller_id
    WHERE x.status='active' AND public.store_name_key(s.store_name) = k
    ORDER BY x.created_at LIMIT 1;
  RETURN coalesce(r, _input);
END $$;
GRANT EXECUTE ON FUNCTION public.resolve_store_code(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_name_key(text) TO anon, authenticated, service_role;