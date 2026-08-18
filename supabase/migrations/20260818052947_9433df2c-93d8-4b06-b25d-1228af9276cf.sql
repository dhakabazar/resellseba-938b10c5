CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
 RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(r2.frozen_amount,0) AS frozen FROM public.resellers r2 WHERE r2.id=_reseller_id
  ), dep AS (
    SELECT COALESCE(SUM(rd.amount),0) AS bal FROM public.reseller_deposits rd WHERE rd.reseller_id=_reseller_id
  )
  SELECT d.amt, p.pending, p.paid,
         GREATEST(d.amt + dep.bal - p.pending - p.paid - f.frozen, 0),
         dep.bal, f.frozen
  FROM d,p,f,dep;
END $function$;