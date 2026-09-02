DROP POLICY IF EXISTS "Staff manage shipments by permission" ON public.shipments;
CREATE POLICY "Staff manage shipments by permission" ON public.shipments FOR ALL TO authenticated
USING (has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']))
WITH CHECK (has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']));

DROP POLICY IF EXISTS "Staff manage courier events by permission" ON public.courier_events;
CREATE POLICY "Staff manage courier events by permission" ON public.courier_events FOR ALL TO authenticated
USING (has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']))
WITH CHECK (has_any_permission(auth.uid(), ARRAY['couriers.manage','orders.ship','orders.status','orders.edit']));

DROP POLICY IF EXISTS "Staff add order history by permission" ON public.order_status_history;
CREATE POLICY "Staff add order history by permission" ON public.order_status_history FOR INSERT TO authenticated
WITH CHECK (has_any_permission(auth.uid(), ARRAY['orders.edit','orders.status','orders.ship','couriers.manage']));