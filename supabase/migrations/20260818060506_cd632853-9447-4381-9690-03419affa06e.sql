CREATE OR REPLACE FUNCTION public.reseller_ledger(_reseller_id uuid, _limit integer DEFAULT 200)
 RETURNS TABLE(at timestamp with time zone, kind text, direction text, label text, reference text, status text, amount numeric, running numeric)
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
  WITH ev AS (
    SELECT rd.created_at AS at, 'deposit'::text AS kind, 'in'::text AS direction,
           'Security deposit'::text AS label,
           COALESCE(NULLIF(rd.reference,''), rd.method, '—')::text AS reference,
           'confirmed'::text AS status, rd.amount::numeric AS amount,
           rd.amount::numeric AS delta
    FROM public.reseller_deposits rd WHERE rd.reseller_id = _reseller_id
    UNION ALL
    SELECT o.updated_at, 'profit', 'in',
           ('Order profit · #' || o.order_number),
           o.customer_name, o.status::text, o.reseller_profit, o.reseller_profit
    FROM public.orders o
    WHERE o.reseller_id = _reseller_id AND o.status = 'delivered' AND o.reseller_profit <> 0
    UNION ALL
    SELECT py.created_at, 'payout',
           CASE WHEN py.status = 'rejected' THEN 'void' ELSE 'out' END,
           'Withdraw request',
           COALESCE(NULLIF(py.notes,''), NULLIF(py.reference,''), '—'),
           py.status::text, py.amount,
           CASE WHEN py.status = 'rejected' THEN 0 ELSE -py.amount END
    FROM public.payouts py WHERE py.reseller_id = _reseller_id
  ), ordered AS (
    SELECT ev.*, SUM(ev.delta) OVER (ORDER BY ev.at, ev.kind ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
    FROM ev
  )
  SELECT ordered.at, ordered.kind, ordered.direction, ordered.label, ordered.reference,
         ordered.status, ordered.amount, ordered.running
  FROM ordered
  ORDER BY ordered.at DESC
  LIMIT GREATEST(_limit, 1);
END $function$;