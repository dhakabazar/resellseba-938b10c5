-- 1. my_permissions(): only staff custom-role permissions count, and super admins get everything.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_super_admin(auth.uid())
      THEN (SELECT COALESCE(array_agg(DISTINCT p.name), ARRAY[]::text[]) FROM public.permissions p)
    ELSE (
      SELECT COALESCE(array_agg(DISTINCT p.name), ARRAY[]::text[])
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = auth.uid() AND ur.role = 'staff'
    )
  END;
$function$;

-- 2. visitors.view must actually unlock the store visitors report.
CREATE OR REPLACE FUNCTION public.store_visit_access(_reseller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_any_permission(auth.uid(), ARRAY['visitors.view','dashboard.view','reports.view','finance.view','resellers.manage'])
    OR (_reseller_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.resellers r WHERE r.id = _reseller_id AND r.user_id = auth.uid()))
  );
$function$;

CREATE OR REPLACE FUNCTION public.purge_store_visits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['visitors.view','reports.view','resellers.manage','settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.store_visits WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$;

-- 3. maintenance.manage must actually unlock cache & cleanup.
CREATE OR REPLACE FUNCTION public.cleanup_counts()
RETURNS TABLE(key text, rows bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE k text; n bigint; cut timestamptz;
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
    IF cut IS NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', k) INTO n;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE created_at < %L', k, cut) INTO n;
    END IF;
    key := k; rows := COALESCE(n, 0);
    RETURN NEXT;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.cleanup_purge(_keys text[])
RETURNS TABLE(key text, rows bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE k text; n bigint; cut timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['maintenance.manage','settings.manage']) THEN
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
      EXECUTE format('DELETE FROM public.%I WHERE created_at < %L', k, cut);
    END IF;
    GET DIAGNOSTICS n = ROW_COUNT;
    key := k; rows := COALESCE(n, 0);
    RETURN NEXT;
  END LOOP;
END $function$;

-- 4. Page-loading RPCs were open to ANY staff account; require the same
--    permissions the panel uses to show those pages.
DO $do$
DECLARE
  spec record;
  def text;
  old_guard text := 'if not (public.has_role(auth.uid(), ''super_admin'') or public.has_role(auth.uid(), ''staff'')) then';
  new_guard text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('admin_dashboard', ARRAY['dashboard.view','finance.view','reports.view']),
      ('admin_orders_page', ARRAY['orders.view','orders.edit','orders.create','orders.delete','orders.status','orders.ship']),
      ('admin_catalog_page', ARRAY['products.view','products.manage','brands.manage','categories.manage']),
      ('admin_lookups', ARRAY['orders.view','orders.create','orders.edit','products.view','products.manage','resellers.manage'])
    ) AS t(fname, perms)
  LOOP
    FOR def IN
      SELECT pg_get_functiondef(p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = spec.fname
    LOOP
      new_guard := 'if not public.has_any_permission(auth.uid(), ' || quote_literal(spec.perms::text) || '::text[]) then';
      IF position(old_guard in def) > 0 THEN
        EXECUTE replace(def, old_guard, new_guard);
      END IF;
    END LOOP;
  END LOOP;
END $do$;