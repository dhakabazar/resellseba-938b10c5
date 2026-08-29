-- PRODUCTS: granular staff policies
DROP POLICY IF EXISTS "Staff insert products by permission" ON public.products;
CREATE POLICY "Staff insert products by permission" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'products.create'));

DROP POLICY IF EXISTS "Staff update products by permission" ON public.products;
CREATE POLICY "Staff update products by permission" ON public.products
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'products.edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'products.edit'));

DROP POLICY IF EXISTS "Staff delete products by permission" ON public.products;
CREATE POLICY "Staff delete products by permission" ON public.products
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'products.delete'));

DROP POLICY IF EXISTS "Staff read products by permission" ON public.products;
CREATE POLICY "Staff read products by permission" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY[
    'products.view','products.manage','products.create','products.edit','products.delete',
    'orders.view','orders.create','orders.edit','finance.view','reports.view','dashboard.view'
  ]));

-- RESELLERS: granular staff policies
DROP POLICY IF EXISTS "Staff insert resellers by permission" ON public.resellers;
CREATE POLICY "Staff insert resellers by permission" ON public.resellers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'resellers.create'));

DROP POLICY IF EXISTS "Staff update resellers by permission" ON public.resellers;
CREATE POLICY "Staff update resellers by permission" ON public.resellers
  FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['resellers.edit','resellers.deposit','resellers.verify']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['resellers.edit','resellers.deposit','resellers.verify']));

DROP POLICY IF EXISTS "Staff delete resellers by permission" ON public.resellers;
CREATE POLICY "Staff delete resellers by permission" ON public.resellers
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(), 'resellers.delete'));

DROP POLICY IF EXISTS "Staff read resellers by permission" ON public.resellers;
CREATE POLICY "Staff read resellers by permission" ON public.resellers
  FOR SELECT TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY[
    'resellers.manage','resellers.view','resellers.create','resellers.edit','resellers.delete',
    'resellers.verify','resellers.deposit','resellers.password','resellers.impersonate',
    'orders.view','orders.create','orders.edit','dashboard.view','finance.view','reports.view',
    'payouts.manage','commissions.manage'
  ]));

-- PROFILES: readable by reseller-managing roles
DROP POLICY IF EXISTS "Staff read profiles for reseller management" ON public.profiles;
CREATE POLICY "Staff read profiles for reseller management" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY[
    'resellers.manage','resellers.view','resellers.edit','resellers.verify','resellers.deposit'
  ]));
