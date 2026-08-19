CREATE OR REPLACE FUNCTION public.cleanup_counts()
RETURNS TABLE(key text, rows bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE k text; n bigint; cut timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOREACH k IN ARRAY ARRAY['audit_log','store_visits','courier_events','notification_logs'] LOOP
    IF to_regclass('public.' || k) IS NULL THEN CONTINUE; END IF;
    cut := CASE k WHEN 'store_visits' THEN now() - interval '30 days'
                  WHEN 'courier_events' THEN now() - interval '60 days'
                  WHEN 'notification_logs' THEN now() - interval '60 days'
                  ELSE NULL END;
    IF cut IS NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', k) INTO n;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at < $1', k) INTO n USING cut;
    END IF;
    RETURN QUERY SELECT k, n;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_purge(_keys text[])
RETURNS TABLE(key text, rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE k text; n bigint; cut timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOREACH k IN ARRAY COALESCE(_keys, ARRAY[]::text[]) LOOP
    IF k NOT IN ('audit_log','store_visits','courier_events','notification_logs') THEN CONTINUE; END IF;
    IF to_regclass('public.' || k) IS NULL THEN CONTINUE; END IF;
    cut := CASE k WHEN 'store_visits' THEN now() - interval '30 days'
                  WHEN 'courier_events' THEN now() - interval '60 days'
                  WHEN 'notification_logs' THEN now() - interval '60 days'
                  ELSE NULL END;
    IF cut IS NULL THEN
      EXECUTE format('DELETE FROM public.%I', k);
    ELSE
      EXECUTE format('DELETE FROM public.%I WHERE created_at < $1', k) USING cut;
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN QUERY SELECT k, n;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.cleanup_counts() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_purge(text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.cleanup_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_purge(text[]) TO authenticated;