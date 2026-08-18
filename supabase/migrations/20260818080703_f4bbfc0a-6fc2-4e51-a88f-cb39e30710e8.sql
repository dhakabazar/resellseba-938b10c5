CREATE OR REPLACE FUNCTION public.sync_order_profit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.reseller_profit := ROUND(COALESCE(NEW.total,0) - COALESCE(NEW.shipping_cost,0) - COALESCE(NEW.sa_cost_total,0), 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_profit ON public.orders;
CREATE TRIGGER trg_sync_order_profit
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_profit();