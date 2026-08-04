CREATE OR REPLACE FUNCTION public.admin_reseller_metrics()
RETURNS TABLE(
  reseller_id uuid,
  orders bigint,
  delivered_profit numeric,
  pending_payout numeric,
  paid_out numeric,
  available numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH o AS (
    SELECT o.reseller_id,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
    FROM public.orders o
    GROUP BY o.reseller_id
  ),
  p AS (
    SELECT py.reseller_id,
           COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END), 0) AS pending_payout,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0) AS paid_out
    FROM public.payouts py
    GROUP BY py.reseller_id
  )
  SELECT r.id,
         COALESCE(o.orders, 0),
         COALESCE(o.delivered_profit, 0),
         COALESCE(p.pending_payout, 0),
         COALESCE(p.paid_out, 0),
         GREATEST(COALESCE(o.delivered_profit,0) - COALESCE(p.pending_payout,0) - COALESCE(p.paid_out,0), 0)
  FROM public.resellers r
  LEFT JOIN o ON o.reseller_id = r.id
  LEFT JOIN p ON p.reseller_id = r.id
  WHERE public.is_super_admin(auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reseller_metrics() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reseller_metrics() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_reseller_metrics() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_orders_reseller_status ON public.orders (reseller_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_reseller_status ON public.payouts (reseller_id, status);