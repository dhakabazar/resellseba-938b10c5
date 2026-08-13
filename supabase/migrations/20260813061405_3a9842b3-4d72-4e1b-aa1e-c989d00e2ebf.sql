GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_settings, public.reseller_listings, public.reseller_domains TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

CREATE POLICY "Staff read profiles for reseller management" ON public.profiles FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage'));

CREATE POLICY "Staff manage reseller settings by permission" ON public.reseller_settings FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage'));
CREATE POLICY "Staff manage reseller listings by permission" ON public.reseller_listings FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage'));
CREATE POLICY "Staff manage reseller domains by permission" ON public.reseller_domains FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage'));

CREATE POLICY "Staff assign reseller roles by permission" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage') AND role IN ('reseller','leader'));
CREATE POLICY "Staff update reseller roles by permission" ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage') AND role IN ('reseller','leader'))
WITH CHECK (public.has_permission(auth.uid(), 'resellers.manage') AND role IN ('reseller','leader'));
CREATE POLICY "Staff delete reseller roles by permission" ON public.user_roles FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'resellers.manage') AND role IN ('reseller','leader'));

CREATE POLICY "Staff read shipments for reports" ON public.shipments FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['finance.view','reports.view','dashboard.view']));
CREATE POLICY "Staff read commissions for reports" ON public.leader_commissions FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['finance.view','reports.view','dashboard.view']));
CREATE POLICY "Staff read payouts for dashboard" ON public.payouts FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'dashboard.view'));

GRANT EXECUTE ON FUNCTION public.generate_product_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_reseller_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_charge(uuid, text) TO authenticated;