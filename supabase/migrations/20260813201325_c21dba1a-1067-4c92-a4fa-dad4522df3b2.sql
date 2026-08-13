-- 1. Reseller columns
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS deposit_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_required_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frozen_amount numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Global defaults
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS deposit_trigger_default_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_default_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_default_frozen numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Deposit ledger
CREATE TABLE IF NOT EXISTS public.reseller_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method text,
  reference text,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reseller_deposits_reseller_idx ON public.reseller_deposits(reseller_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_deposits TO authenticated;
GRANT ALL ON public.reseller_deposits TO service_role;
ALTER TABLE public.reseller_deposits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deposits_select_own_or_admin" ON public.reseller_deposits;
CREATE POLICY "deposits_select_own_or_admin" ON public.reseller_deposits
  FOR SELECT TO authenticated
  USING (
    reseller_id = public.current_reseller_id()
    OR public.has_any_permission(auth.uid(), ARRAY['resellers.manage','finance.view','reports.view','payouts.manage','dashboard.view'])
  );

DROP POLICY IF EXISTS "deposits_admin_insert" ON public.reseller_deposits;
CREATE POLICY "deposits_admin_insert" ON public.reseller_deposits
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['resellers.manage','finance.view','payouts.manage']));

DROP POLICY IF EXISTS "deposits_admin_update" ON public.reseller_deposits;
CREATE POLICY "deposits_admin_update" ON public.reseller_deposits
  FOR UPDATE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['resellers.manage','finance.view','payouts.manage']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['resellers.manage','finance.view','payouts.manage']));

DROP POLICY IF EXISTS "deposits_admin_delete" ON public.reseller_deposits;
CREATE POLICY "deposits_admin_delete" ON public.reseller_deposits
  FOR DELETE TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['resellers.manage','payouts.manage']));

-- 4. Balance helper
CREATE OR REPLACE FUNCTION public.reseller_deposit_balance(_reseller_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount), 0) FROM public.reseller_deposits WHERE reseller_id = _reseller_id;
$$;
GRANT EXECUTE ON FUNCTION public.reseller_deposit_balance(uuid) TO authenticated, service_role;

-- 5. Protect the new admin-only reseller fields from reseller self-edits
CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_permission(auth.uid(), 'resellers.manage') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.deposit_required IS DISTINCT FROM OLD.deposit_required
     OR NEW.deposit_required_amount IS DISTINCT FROM OLD.deposit_required_amount
     OR NEW.frozen_amount IS DISTINCT FROM OLD.frozen_amount
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;
  RETURN NEW;
END $$;

-- 6. Apply defaults for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_phone text;
  v_email_prefix text;
  v_business text;
  v_code text;
  v_is_admin boolean;
  v_is_staff boolean;
  v_dep_on boolean := false;
  v_dep_amt numeric := 0;
  v_frozen numeric := 0;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_email_prefix := split_part(COALESCE(NEW.email,''), '@', 1);

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, v_name, v_phone)
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role IN ('super_admin','staff'))
    INTO v_is_admin;
  v_is_staff := COALESCE(NEW.raw_user_meta_data->>'is_staff', 'false') = 'true';
  IF v_is_admin OR v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.resellers WHERE user_id = NEW.id) THEN
    v_business := NULLIF(trim(v_name), '');
    IF v_business IS NULL THEN
      v_business := NULLIF(trim(v_email_prefix), '');
    END IF;
    IF v_business IS NULL THEN
      v_business := 'New reseller';
    END IF;
    v_code := public.generate_reseller_code(COALESCE(v_email_prefix, v_business));

    SELECT COALESCE(deposit_trigger_default_on,false), COALESCE(deposit_default_amount,0), COALESCE(deposit_default_frozen,0)
      INTO v_dep_on, v_dep_amt, v_frozen
      FROM public.global_settings WHERE id = 1;

    INSERT INTO public.resellers (user_id, business_name, code, contact_phone, status,
                                  deposit_required, deposit_required_amount, frozen_amount)
    VALUES (NEW.id, v_business, v_code, NULLIF(v_phone,''), 'pending',
            COALESCE(v_dep_on,false), COALESCE(v_dep_amt,0), COALESCE(v_frozen,0));
  END IF;

  RETURN NEW;
END $$;

-- 7. Deposit gate on order confirmation
CREATE OR REPLACE FUNCTION public.enforce_reseller_deposit_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req boolean; v_amt numeric; v_bal numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'confirmed' THEN RETURN NEW; END IF;
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
    RAISE EXCEPTION 'Security deposit baki ache: %.2f BDT deposit korte hobe (ekhon jomma %.2f BDT). Deposit na korle order confirm kora jabe na.', v_amt, v_bal;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_deposit_gate_orders ON public.orders;
CREATE TRIGGER trg_deposit_gate_orders
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reseller_deposit_gate();

-- 8. Frozen amount blocks payout requests
CREATE OR REPLACE FUNCTION public.enforce_payout_freeze()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_frozen numeric; v_delivered numeric; v_pending numeric; v_paid numeric; v_avail numeric;
BEGIN
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_any_permission(auth.uid(), ARRAY['payouts.manage','finance.view']) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(frozen_amount,0) INTO v_frozen FROM public.resellers WHERE id = NEW.reseller_id;
  SELECT COALESCE(SUM(reseller_profit),0) INTO v_delivered FROM public.orders
    WHERE reseller_id = NEW.reseller_id AND status = 'delivered';
  SELECT COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),0)
    INTO v_pending, v_paid FROM public.payouts WHERE reseller_id = NEW.reseller_id AND id <> NEW.id;

  v_avail := GREATEST(v_delivered - v_pending - v_paid - COALESCE(v_frozen,0), 0);
  IF NEW.amount > v_avail THEN
    RAISE EXCEPTION 'Withdraw limit: sorbocho %.2f BDT tola jabe (%.2f BDT freeze kora ache).', v_avail, COALESCE(v_frozen,0);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payout_freeze ON public.payouts;
CREATE TRIGGER trg_payout_freeze
  BEFORE INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payout_freeze();

-- 9. Summaries account for frozen amount
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage'])
     AND NOT EXISTS (SELECT 1 FROM public.resellers r WHERE r.id=_reseller_id AND r.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH d AS (
    SELECT COALESCE(SUM(o.reseller_profit),0) AS amt FROM public.orders o
    WHERE o.reseller_id=_reseller_id AND o.status='delivered'
  ), p AS (
    SELECT COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END),0) AS pending,
           COALESCE(SUM(CASE WHEN py.status='paid' THEN py.amount ELSE 0 END),0) AS paid
    FROM public.payouts py WHERE py.reseller_id=_reseller_id
  ), f AS (
    SELECT COALESCE(frozen_amount,0) AS frozen FROM public.resellers WHERE id=_reseller_id
  )
  SELECT d.amt,p.pending,p.paid,GREATEST(d.amt-p.pending-p.paid-f.frozen,0) FROM d,p,f;
END $$;

DROP FUNCTION IF EXISTS public.admin_reseller_metrics();
CREATE OR REPLACE FUNCTION public.admin_reseller_metrics()
RETURNS TABLE(reseller_id uuid, orders bigint, delivered_profit numeric, pending_payout numeric,
              paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH o AS (
    SELECT o.reseller_id,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
    FROM public.orders o GROUP BY o.reseller_id
  ), p AS (
    SELECT py.reseller_id,
           COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END), 0) AS pending_payout,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0) AS paid_out
    FROM public.payouts py GROUP BY py.reseller_id
  ), d AS (
    SELECT rd.reseller_id, COALESCE(SUM(rd.amount),0) AS deposit_balance
    FROM public.reseller_deposits rd GROUP BY rd.reseller_id
  )
  SELECT r.id, COALESCE(o.orders,0), COALESCE(o.delivered_profit,0),
         COALESCE(p.pending_payout,0), COALESCE(p.paid_out,0),
         GREATEST(COALESCE(o.delivered_profit,0)-COALESCE(p.pending_payout,0)-COALESCE(p.paid_out,0)-COALESCE(r.frozen_amount,0),0),
         COALESCE(d.deposit_balance,0), COALESCE(r.frozen_amount,0)
  FROM public.resellers r
  LEFT JOIN o ON o.reseller_id=r.id
  LEFT JOIN p ON p.reseller_id=r.id
  LEFT JOIN d ON d.reseller_id=r.id
  WHERE public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage']);
$$;
GRANT EXECUTE ON FUNCTION public.admin_reseller_metrics() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) TO authenticated, service_role;