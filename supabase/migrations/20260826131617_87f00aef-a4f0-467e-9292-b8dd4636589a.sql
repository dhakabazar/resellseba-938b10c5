-- 1. Cost snapshot on every order line (frozen at creation time)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS buying_price numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Backfill legacy rows from the products they point at (best available value)
UPDATE public.order_items oi
SET buying_price = COALESCE(p.buying_price, 0),
    packaging_cost = COALESCE(p.packaging_cost, 0)
FROM public.products p
WHERE p.id = oi.product_id
  AND oi.buying_price = 0
  AND oi.packaging_cost = 0;

-- 3. Snapshot the product costs when a line is created; never on later updates
CREATE OR REPLACE FUNCTION public.snapshot_order_item_costs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buy numeric(12,2);
  v_pack numeric(12,2);
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(buying_price, 0), COALESCE(packaging_cost, 0)
      INTO v_buy, v_pack
    FROM public.products WHERE id = NEW.product_id;
    IF COALESCE(NEW.buying_price, 0) = 0 THEN NEW.buying_price := COALESCE(v_buy, 0); END IF;
    IF COALESCE(NEW.packaging_cost, 0) = 0 THEN NEW.packaging_cost := COALESCE(v_pack, 0); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_snapshot_order_item_costs ON public.order_items;
CREATE TRIGGER trg_snapshot_order_item_costs
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_costs();

-- 4. Packaging total now uses the frozen line values, not today's product price
CREATE OR REPLACE FUNCTION public.recalc_order_packaging(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum boolean;
  v_total numeric(12,2);
BEGIN
  SELECT COALESCE((advanced_settings->>'packagingChargeSum')::boolean, true)
    INTO v_sum FROM public.global_settings WHERE id = 1;
  v_sum := COALESCE(v_sum, true);

  IF v_sum THEN
    SELECT COALESCE(SUM(COALESCE(oi.packaging_cost,0) * oi.quantity), 0) INTO v_total
    FROM public.order_items oi WHERE oi.order_id = _order_id;
  ELSE
    SELECT COALESCE(MAX(COALESCE(oi.packaging_cost,0)), 0) INTO v_total
    FROM public.order_items oi WHERE oi.order_id = _order_id;
  END IF;

  UPDATE public.orders o SET packaging_total = v_total WHERE o.id = _order_id;
END $$;