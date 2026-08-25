CREATE OR REPLACE FUNCTION public.order_has_shipment(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.shipments s
    WHERE s.order_id = _order_id
  )
$$;

REVOKE ALL ON FUNCTION public.order_has_shipment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.order_has_shipment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.order_has_shipment(uuid) TO service_role;

DROP POLICY IF EXISTS "Resellers delete own early orders" ON public.orders;
CREATE POLICY "Resellers delete own early orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  reseller_id = public.current_reseller_id()
  AND status IN ('draft', 'pending', 'forwarded', 'cancelled')
  AND NOT public.order_has_shipment(id)
);