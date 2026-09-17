CREATE OR REPLACE FUNCTION public.admin_payout_overview()
 RETURNS TABLE(reseller_id uuid, code text, business_name text, owner_phone text, delivered_profit numeric, deposit_balance numeric, frozen_amount numeric, requests_count integer, requested_total numeric, pending_amount numeric, approved_amount numeric, paid_out numeric, rejected_amount numeric, available numeric, last_request_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['payouts.manage','finance.view','reports.view','dashboard.view']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH prof AS (
    SELECT o.reseller_id AS rid, COALESCE(SUM(o.reseller_profit),0) AS amt
    FROM public.orders o
    WHERE o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled')
    GROUP BY o.reseller_id
  ), pay AS (
    SELECT py.reseller_id AS rid,
      COUNT(*)::int AS cnt,
      COALESCE(SUM(py.amount),0) AS total,
      COALESCE(SUM(CASE WHEN py.status='pending' THEN py.amount ELSE 0 END),0) AS pend,
      COALESCE(SUM(CASE WHEN py.status='approved' THEN py.amount ELSE 0 END),0) AS appr,
      COALESCE(SUM(CASE WHEN py.status='paid' THEN py.amount ELSE 0 END),0) AS paid,
      COALESCE(SUM(CASE WHEN py.status='rejected' THEN py.amount ELSE 0 END),0) AS rej,
      MAX(py.created_at) AS last_at
    FROM public.payouts py
    GROUP BY py.reseller_id
  ), dep AS (
    SELECT rd.reseller_id AS rid, COALESCE(SUM(rd.amount),0) AS bal
    FROM public.reseller_deposits rd GROUP BY rd.reseller_id
  )
  SELECT r.id, r.code, r.business_name, COALESCE(r.contact_phone, p.phone),
    COALESCE(prof.amt,0),
    COALESCE(dep.bal,0),
    COALESCE(r.frozen_amount,0),
    COALESCE(pay.cnt,0),
    COALESCE(pay.total,0),
    COALESCE(pay.pend,0),
    COALESCE(pay.appr,0),
    COALESCE(pay.paid,0),
    COALESCE(pay.rej,0),
    GREATEST(COALESCE(prof.amt,0) + COALESCE(dep.bal,0) - COALESCE(pay.pend,0) - COALESCE(pay.appr,0) - COALESCE(pay.paid,0) - COALESCE(r.frozen_amount,0), 0),
    pay.last_at
  FROM public.resellers r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  LEFT JOIN prof ON prof.rid = r.id
  LEFT JOIN pay ON pay.rid = r.id
  LEFT JOIN dep ON dep.rid = r.id;
END $function$;