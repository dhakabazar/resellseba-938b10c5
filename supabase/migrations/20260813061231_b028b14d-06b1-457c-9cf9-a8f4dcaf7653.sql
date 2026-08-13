CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND ur.role = 'staff'
        AND p.name = _permission
    );
$$;

CREATE OR REPLACE FUNCTION public.has_any_permission(_user_id uuid, _permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.custom_role_id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = _user_id
        AND ur.role = 'staff'
        AND p.name = ANY(_permissions)
    );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_any_permission(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_permission(uuid, text[]) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products, public.product_images, public.brands, public.categories, public.orders, public.order_items, public.order_status_history, public.shipments, public.courier_events, public.resellers, public.payouts, public.leader_commissions, public.marketing_configs, public.notification_configs, public.notification_logs, public.payment_configs, public.courier_configs, public.global_settings, public.audit_log TO authenticated;
GRANT SELECT ON public.roles, public.permissions, public.role_permissions, public.user_roles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.roles, public.permissions, public.role_permissions, public.user_roles TO authenticated;

CREATE POLICY "Staff manage products by permission" ON public.products FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'products.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'products.manage'));
CREATE POLICY "Staff read products by permission" ON public.products FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['products.view','products.manage','orders.view','orders.create','orders.edit','finance.view','reports.view','dashboard.view']));

CREATE POLICY "Staff manage product images by permission" ON public.product_images FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'products.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'products.manage'));
CREATE POLICY "Staff read product images by permission" ON public.product_images FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['products.view','products.manage','orders.view','orders.create','orders.edit','finance.view','reports.view','dashboard.view']));

CREATE POLICY "Staff manage brands by permission" ON public.brands FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'brands.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'brands.manage'));
CREATE POLICY "Staff manage categories by permission" ON public.categories FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'categories.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'categories.manage'));

CREATE POLICY "Staff read orders by permission" ON public.orders FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.create','orders.edit','orders.delete','dashboard.view','finance.view','reports.view','payouts.manage','commissions.manage']));
CREATE POLICY "Staff create orders by permission" ON public.orders FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'orders.create'));
CREATE POLICY "Staff edit orders by permission" ON public.orders FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'orders.edit'))
WITH CHECK (public.has_permission(auth.uid(), 'orders.edit'));
CREATE POLICY "Staff delete orders by permission" ON public.orders FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'orders.delete'));

CREATE POLICY "Staff read order items by permission" ON public.order_items FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.create','orders.edit','orders.delete','dashboard.view','finance.view','reports.view','payouts.manage','commissions.manage']));
CREATE POLICY "Staff create order items by permission" ON public.order_items FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'orders.create'));
CREATE POLICY "Staff edit order items by permission" ON public.order_items FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'orders.edit'))
WITH CHECK (public.has_permission(auth.uid(), 'orders.edit'));
CREATE POLICY "Staff delete order items by permission" ON public.order_items FOR DELETE TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.edit','orders.delete']));

CREATE POLICY "Staff read order history by permission" ON public.order_status_history FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.edit','dashboard.view','finance.view','reports.view']));
CREATE POLICY "Staff add order history by permission" ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'orders.edit'));

CREATE POLICY "Staff read shipments by permission" ON public.shipments FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.edit','couriers.manage']));
CREATE POLICY "Staff manage shipments by permission" ON public.shipments FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'couriers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'couriers.manage'));
CREATE POLICY "Staff read courier events by permission" ON public.courier_events FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['orders.view','orders.edit','couriers.manage']));
CREATE POLICY "Staff manage courier events by permission" ON public.courier_events FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'couriers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'couriers.manage'));
CREATE POLICY "Staff manage courier config by permission" ON public.courier_configs FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'couriers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'couriers.manage'));

CREATE POLICY "Staff read resellers by permission" ON public.resellers FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['resellers.manage','orders.view','orders.create','orders.edit','dashboard.view','finance.view','reports.view','payouts.manage','commissions.manage']));
CREATE POLICY "Staff manage resellers by permission" ON public.resellers FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage'));

CREATE POLICY "Staff read payouts by permission" ON public.payouts FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['payouts.manage','finance.view','reports.view','dashboard.view']));
CREATE POLICY "Staff manage payouts by permission" ON public.payouts FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'payouts.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'payouts.manage'));
CREATE POLICY "Staff manage commissions by permission" ON public.leader_commissions FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'commissions.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'commissions.manage'));

CREATE POLICY "Staff manage marketing by permission" ON public.marketing_configs FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'marketing.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'marketing.manage'));
CREATE POLICY "Staff manage notification config by permission" ON public.notification_configs FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'notifications.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'notifications.manage'));
CREATE POLICY "Staff read notification logs by permission" ON public.notification_logs FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'notifications.manage'));
CREATE POLICY "Staff add notification logs by permission" ON public.notification_logs FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'notifications.manage'));
CREATE POLICY "Staff manage payments by permission" ON public.payment_configs FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'payments.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'payments.manage'));

CREATE POLICY "Staff update landing and settings by permission" ON public.global_settings FOR UPDATE TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage']))
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage']));
CREATE POLICY "Staff insert landing and settings by permission" ON public.global_settings FOR INSERT TO authenticated
WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['landing.manage','settings.manage']));
CREATE POLICY "Staff read audit by permission" ON public.audit_log FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'audit.view'));

CREATE POLICY "Staff view roles by permission" ON public.roles FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'));
CREATE POLICY "Staff view permissions by permission" ON public.permissions FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'));
CREATE POLICY "Staff view role permissions by permission" ON public.role_permissions FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'));
CREATE POLICY "Staff view users by permission" ON public.user_roles FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'));

CREATE POLICY "Staff upload product images by permission" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.has_permission(auth.uid(), 'products.manage'));
CREATE POLICY "Staff update product images by permission" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.has_permission(auth.uid(), 'products.manage'))
WITH CHECK (bucket_id = 'product-images' AND public.has_permission(auth.uid(), 'products.manage'));
CREATE POLICY "Staff delete product images by permission" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.has_permission(auth.uid(), 'products.manage'));
CREATE POLICY "Staff manage branding by permission" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'branding' AND public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']))
WITH CHECK (bucket_id = 'branding' AND public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']));

CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_permission(auth.uid(), 'resellers.manage') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lock_order_status_after_courier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.uid() IS NULL
       OR public.is_super_admin(auth.uid())
       OR public.has_permission(auth.uid(), 'orders.edit')
       OR public.has_permission(auth.uid(), 'couriers.manage') THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.order_id = NEW.id
        AND (s.consignment_id IS NOT NULL OR s.tracking_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Order courier e chole gese — status only authorized admin staff change korte parbe';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reseller_metrics()
RETURNS TABLE(reseller_id uuid, orders bigint, delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH o AS (
    SELECT o.reseller_id,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
    FROM public.orders o GROUP BY o.reseller_id
  ), p AS (
    SELECT py.reseller_id,
           COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END), 0) AS pending_payout,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0) AS paid_out
    FROM public.payouts py GROUP BY py.reseller_id
  )
  SELECT r.id, COALESCE(o.orders,0), COALESCE(o.delivered_profit,0),
         COALESCE(p.pending_payout,0), COALESCE(p.paid_out,0),
         GREATEST(COALESCE(o.delivered_profit,0)-COALESCE(p.pending_payout,0)-COALESCE(p.paid_out,0),0)
  FROM public.resellers r
  LEFT JOIN o ON o.reseller_id=r.id
  LEFT JOIN p ON p.reseller_id=r.id
  WHERE public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage']);
$$;

CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage'])
     AND NOT EXISTS (SELECT 1 FROM public.resellers r WHERE r.id=_reseller_id AND r.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH d AS (
    SELECT COALESCE(SUM(o.reseller_profit),0) AS amt FROM public.orders o
    WHERE o.reseller_id=_reseller_id AND o.status='delivered'
  ), p AS (
    SELECT COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END),0) AS pending,
           COALESCE(SUM(CASE WHEN py.status='paid' THEN py.amount ELSE 0 END),0) AS paid
    FROM public.payouts py WHERE py.reseller_id=_reseller_id
  )
  SELECT d.amt,p.pending,p.paid,GREATEST(d.amt-p.pending-p.paid,0) FROM d,p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reseller_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) TO authenticated;