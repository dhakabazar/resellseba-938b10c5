DROP POLICY IF EXISTS "Staff manage payouts by permission" ON public.payouts;

CREATE POLICY "Staff update payouts by permission"
ON public.payouts FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'payouts.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'payouts.manage'));

CREATE POLICY "Staff insert payouts by permission"
ON public.payouts FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'payouts.manage'));