-- deposit gate now fires when the reseller sends the order to admin, or on admin confirm
CREATE OR REPLACE FUNCTION public.enforce_reseller_deposit_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req boolean; v_amt numeric; v_bal numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('confirmed','forwarded') THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_any_permission(auth.uid(), ARRAY['orders.edit','couriers.manage','finance.view']) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(deposit_required,false), COALESCE(deposit_required_amount,0)
    INTO v_req, v_amt FROM public.resellers WHERE id = NEW.reseller_id;
  IF NOT v_req OR v_amt <= 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_bal FROM public.reseller_deposits WHERE reseller_id = NEW.reseller_id;
  IF v_bal < v_amt THEN
    RAISE EXCEPTION 'Security deposit baki ache: %.2f BDT deposit korte hobe (ekhon jomma %.2f BDT). Deposit na korle order pathano jabe na.', v_amt, v_bal;
  END IF;
  RETURN NEW;
END $$;

-- reseller can only touch its own order until admin confirms it
CREATE OR REPLACE FUNCTION public.lock_order_status_after_courier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_permission(auth.uid(), 'orders.edit')
     OR public.has_permission(auth.uid(), 'couriers.manage') THEN
    RETURN NEW;
  END IF;

  IF OLD.status NOT IN ('draft','pending','forwarded') THEN
    RAISE EXCEPTION 'Admin order ti confirm kore felecche — ekhon shudhu admin staff change korte parbe';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status NOT IN ('pending','forwarded','cancelled') THEN
    RAISE EXCEPTION 'Reseller shudhu order admin ke pathate ba cancel korte parbe';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.order_id = NEW.id
      AND (s.consignment_id IS NOT NULL OR s.tracking_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Order courier e chole gese — status only authorized admin staff change korte parbe';
  END IF;
  RETURN NEW;
END $$;