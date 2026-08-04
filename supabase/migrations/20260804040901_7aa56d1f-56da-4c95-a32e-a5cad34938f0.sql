-- 1. marketing_configs / payment_configs: remove public raw-table reads, expose safe views
DROP POLICY IF EXISTS "Marketing: public read active" ON public.marketing_configs;
DROP POLICY IF EXISTS "Payments: public read active" ON public.payment_configs;

CREATE OR REPLACE VIEW public.public_marketing_pixels
WITH (security_invoker = false) AS
  SELECT id, reseller_id, platform, pixel_id
  FROM public.marketing_configs
  WHERE is_active = true;

CREATE OR REPLACE VIEW public.public_payment_methods
WITH (security_invoker = false) AS
  SELECT id, reseller_id, method, label, instructions, mode
  FROM public.payment_configs
  WHERE is_active = true;

GRANT SELECT ON public.public_marketing_pixels TO anon, authenticated;
GRANT SELECT ON public.public_payment_methods TO anon, authenticated;

-- 2. reseller_domains: drop the always-true public read policy
DROP POLICY IF EXISTS "Rdomain: public read" ON public.reseller_domains;

-- 3. notification_logs: replace permissive insert policy
DROP POLICY IF EXISTS "System insert notif logs" ON public.notification_logs;
CREATE POLICY "Notif logs: admin or own reseller insert"
  ON public.notification_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id())
  );

-- 4. resellers: block self-service changes to admin-controlled columns
CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_protect_reseller_admin_fields ON public.resellers;
CREATE TRIGGER trg_protect_reseller_admin_fields
  BEFORE UPDATE ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.protect_reseller_admin_fields();

-- 5. SECURITY DEFINER function execution: least privilege
REVOKE EXECUTE ON FUNCTION public.generate_product_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_reseller_code(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_delivery_charge(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_leader_commission_on_delivery() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_reseller_admin_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_reseller_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_public_order(text, text, text, text, text, text, public.delivery_area, text, public.payment_method, text, jsonb) FROM PUBLIC;

-- 6. reseller_profit_summary: in-function authorization check
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_super_admin(auth.uid())
     AND NOT EXISTS (
       SELECT 1 FROM public.resellers r
       WHERE r.id = _reseller_id AND r.user_id = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH d AS (
    SELECT COALESCE(SUM(o.reseller_profit),0) AS amt
    FROM public.orders o WHERE o.reseller_id = _reseller_id AND o.status = 'delivered'
  ),
  p AS (
    SELECT
      COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END),0) AS pending,
      COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END),0) AS paid
    FROM public.payouts py WHERE py.reseller_id = _reseller_id
  )
  SELECT d.amt, p.pending, p.paid, GREATEST(d.amt - p.pending - p.paid, 0) FROM d, p;
END $$;

REVOKE EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) TO authenticated, service_role;