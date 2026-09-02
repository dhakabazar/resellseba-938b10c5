DROP FUNCTION IF EXISTS public.cleanup_counts();
CREATE OR REPLACE FUNCTION public.cleanup_counts()
 RETURNS TABLE(key text, rows bigint, total bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE k text; n bigint; t bigint; cut timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['maintenance.manage','settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  FOREACH k IN ARRAY ARRAY['audit_log','store_visits','courier_events','notification_logs'] LOOP
    IF to_regclass('public.' || k) IS NULL THEN CONTINUE; END IF;
    cut := CASE k WHEN 'store_visits' THEN now() - interval '30 days'
                  WHEN 'courier_events' THEN now() - interval '60 days'
                  WHEN 'notification_logs' THEN now() - interval '60 days'
                  ELSE NULL END;
    EXECUTE format('SELECT count(*) FROM public.%I', k) INTO t;
    IF cut IS NULL THEN
      n := t;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at < %L', k, cut) INTO n;
    END IF;
    key := k; rows := COALESCE(n, 0); total := COALESCE(t, 0);
    RETURN NEXT;
  END LOOP;
END $function$;