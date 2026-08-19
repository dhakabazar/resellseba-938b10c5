-- Advance payment on orders: how much was collected before delivery, and who holds it.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS advance_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_by text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_advance_by_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_advance_by_check
      CHECK (advance_by IS NULL OR advance_by IN ('admin','reseller'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.sync_order_profit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_del numeric;
  v_pack numeric;
  v_recv numeric;
  v_prod numeric;
  v_adv numeric;
  v_res_adv numeric;
BEGIN
  v_del := COALESCE(NULLIF(NEW.delivery_cost, 0), NEW.shipping_cost, 0);
  v_pack := COALESCE(NEW.packaging_total, 0);
  v_adv := GREATEST(COALESCE(NEW.advance_amount, 0), 0);
  v_res_adv := CASE WHEN NEW.advance_by = 'reseller' THEN v_adv ELSE 0 END;
  v_recv := CASE
    WHEN NEW.received_amount IS NOT NULL THEN NEW.received_amount + v_adv
    ELSE COALESCE(NEW.total, 0)
  END;

  IF NEW.status = 'returned' OR NEW.status = 'pending_return' THEN
    NEW.reseller_profit := -ROUND(v_del + v_pack, 2);
  ELSIF NEW.status = 'cancelled' THEN
    NEW.reseller_profit := 0;
  ELSIF NEW.status = 'partial_delivery' THEN
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack - v_res_adv, 2);
  ELSIF NEW.status = 'partial_item' THEN
    IF TG_OP = 'INSERT' THEN
      v_prod := COALESCE(NEW.sa_cost_total,0) - v_pack;
    ELSE
      v_prod := public.order_kept_product_cost(NEW.id);
    END IF;
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack - v_prod - v_res_adv, 2);
  ELSIF NEW.status IN ('delivered','partial','partial_full','damaged') THEN
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack - (COALESCE(NEW.sa_cost_total,0) - v_pack) - v_res_adv, 2);
  ELSE
    NEW.reseller_profit := ROUND(COALESCE(NEW.total,0) - v_del - COALESCE(NEW.sa_cost_total,0) - v_res_adv, 2);
  END IF;
  RETURN NEW;
END $$;