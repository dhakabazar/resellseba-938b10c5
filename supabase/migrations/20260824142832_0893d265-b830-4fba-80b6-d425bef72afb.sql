-- 1. Drop the obsolete audit permission
DELETE FROM public.role_permissions rp USING public.permissions p
  WHERE rp.permission_id = p.id AND p.name = 'audit.view';
DELETE FROM public.permissions WHERE name = 'audit.view';

-- 2. New granular permissions
INSERT INTO public.permissions (name, description) VALUES
  ('expenses.manage', 'Add, edit and delete business expenses'),
  ('deposits.manage', 'Manage reseller security deposits and deposit transactions'),
  ('domains.manage', 'Manage custom domain / DNS configuration'),
  ('maintenance.manage', 'Use cache & cleanup tools'),
  ('visitors.view', 'View the store visitors report'),
  ('settings.advanced', 'Change advanced system settings'),
  ('orders.status', 'Change order status (including bulk scan)'),
  ('orders.ship', 'Book couriers and manage shipments')
ON CONFLICT (name) DO NOTHING;

-- 3. Expenses
DROP POLICY IF EXISTS "Finance staff can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Finance staff can add expenses" ON public.expenses;
DROP POLICY IF EXISTS "Finance staff can edit expenses" ON public.expenses;
DROP POLICY IF EXISTS "Finance staff can delete expenses" ON public.expenses;
CREATE POLICY "Finance staff can view expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['expenses.manage','finance.view','reports.view','settings.manage']));
CREATE POLICY "Finance staff can add expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['expenses.manage','finance.view','settings.manage']));
CREATE POLICY "Finance staff can edit expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['expenses.manage','finance.view','settings.manage']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['expenses.manage','finance.view','settings.manage']));
CREATE POLICY "Finance staff can delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['expenses.manage','finance.view','settings.manage']));

-- 4. Reseller deposits
DROP POLICY IF EXISTS "deposits_select_own_or_admin" ON public.reseller_deposits;
DROP POLICY IF EXISTS "deposits_admin_insert" ON public.reseller_deposits;
DROP POLICY IF EXISTS "deposits_admin_update" ON public.reseller_deposits;
DROP POLICY IF EXISTS "deposits_admin_delete" ON public.reseller_deposits;
CREATE POLICY "deposits_select_own_or_admin" ON public.reseller_deposits FOR SELECT TO authenticated
  USING (reseller_id = public.current_reseller_id()
    OR public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','reports.view','payouts.manage','dashboard.view']));
CREATE POLICY "deposits_admin_insert" ON public.reseller_deposits FOR INSERT TO authenticated
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']));
CREATE POLICY "deposits_admin_update" ON public.reseller_deposits FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','finance.view','payouts.manage']));
CREATE POLICY "deposits_admin_delete" ON public.reseller_deposits FOR DELETE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['deposits.manage','resellers.manage','payouts.manage']));

-- 5. Orders: status-only staff can update, shipping staff can book couriers
DROP POLICY IF EXISTS "Staff edit orders by permission" ON public.orders;
CREATE POLICY "Staff edit orders by permission" ON public.orders FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['orders.edit','orders.status']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['orders.edit','orders.status']));

DROP POLICY IF EXISTS "Staff manage shipments by permission" ON public.shipments;
CREATE POLICY "Staff manage shipments by permission" ON public.shipments FOR ALL TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship']));

DROP POLICY IF EXISTS "Staff read shipments by permission" ON public.shipments;
CREATE POLICY "Staff read shipments by permission" ON public.shipments FOR SELECT TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.edit','orders.status','orders.ship','couriers.manage']));

-- 6. Global settings: advanced settings permission
DROP POLICY IF EXISTS "Staff update landing and settings by permission" ON public.global_settings;
DROP POLICY IF EXISTS "Staff insert landing and settings by permission" ON public.global_settings;
CREATE POLICY "Staff update landing and settings by permission" ON public.global_settings FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage','settings.advanced']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage','settings.advanced']));
CREATE POLICY "Staff insert landing and settings by permission" ON public.global_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage','settings.advanced']));

-- 7. Domain + maintenance functions accept their own permissions
CREATE OR REPLACE FUNCTION public.cf_config_get()
 RETURNS cloudflare_config
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.cloudflare_config;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage','domains.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO r FROM public.cloudflare_config WHERE id = 1;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.cf_config_save(_api_token text, _account_id text, _zone_id text, _zone_name text, _worker_name text, _cname_target text, _a_record_ip text, _auto_worker_domain boolean, _is_active boolean, _mode text DEFAULT 'both'::text, _server_a_ip text DEFAULT ''::text, _server_cname text DEFAULT ''::text, _server_note text DEFAULT ''::text, _dns_active boolean DEFAULT false)
 RETURNS cloudflare_config
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.cloudflare_config;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['settings.manage','domains.manage']) THEN
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
END $function$;