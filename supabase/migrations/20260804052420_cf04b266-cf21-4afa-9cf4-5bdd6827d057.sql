CREATE OR REPLACE FUNCTION public.lock_order_status_after_courier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- service role / webhooks (no auth context) and super admins are always allowed
    IF auth.uid() IS NULL OR public.is_super_admin(auth.uid()) THEN
      RETURN NEW;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.shipments s
      WHERE s.order_id = NEW.id
        AND (s.consignment_id IS NOT NULL OR s.tracking_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Order courier e chole gese — status only super admin change korte parbe';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lock_order_status_after_courier ON public.orders;
CREATE TRIGGER trg_lock_order_status_after_courier
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.lock_order_status_after_courier();