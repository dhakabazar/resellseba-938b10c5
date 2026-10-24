CREATE OR REPLACE FUNCTION public.capi_store_configs(p_code text, p_origin text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; c text := lower(trim(coalesce(p_code,''))); h text; rc text;
BEGIN
  IF c ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN rid := c::uuid; END IF;
  IF rid IS NULL AND c <> '' THEN
    SELECT id INTO rid FROM resellers WHERE lower(code) = c LIMIT 1;
    IF rid IS NULL THEN
      rc := lower(public.resolve_store_code(c));
      SELECT id INTO rid FROM resellers WHERE lower(code) = rc LIMIT 1;
    END IF;
  END IF;
  FOREACH h IN ARRAY ARRAY[c, lower(coalesce(p_origin,''))] LOOP
    EXIT WHEN rid IS NOT NULL;
    h := regexp_replace(regexp_replace(regexp_replace(h,'^https?://',''),'[/:].*$',''),'^www\.','');
    IF h <> '' AND h NOT IN ('localhost','127.0.0.1') THEN
      SELECT reseller_id INTO rid FROM reseller_domains
       WHERE regexp_replace(lower(hostname),'^www\.','') = h LIMIT 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reseller_id', rid, 'configs', coalesce((
    SELECT jsonb_agg(jsonb_build_object('platform',platform,'pixel_id',pixel_id,'access_token',access_token,
      'test_event_code',test_event_code,'is_active',is_active,'reseller_id',reseller_id))
    FROM marketing_configs WHERE is_active AND (reseller_id IS NULL OR reseller_id = rid)), '[]'::jsonb));
END $$;