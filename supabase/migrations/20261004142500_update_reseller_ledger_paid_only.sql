-- Update reseller_ledger RPC to also only include paid payouts on paid_at date and settled orders on settled_at date
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
    -- 1. Security Deposits
    SELECT rd.created_at AS at, 'deposit'::text AS kind, 'in'::text AS direction,
           'Security deposit'::text AS label,
           COALESCE(NULLIF(rd.reference,''), rd.method, '-')::text AS reference,
           'confirmed'::text AS status, rd.amount::numeric AS amount,
           rd.amount::numeric AS delta
    FROM public.reseller_deposits rd WHERE rd.reseller_id = _reseller_id
    UNION ALL
    -- 2. Orders (settled only)
    SELECT COALESCE(o.settled_at, o.updated_at) AS at,
           CASE WHEN o.reseller_profit < 0 THEN 'loss' ELSE 'profit' END::text AS kind,
           CASE WHEN o.reseller_profit < 0 THEN 'out' ELSE 'in' END::text AS direction,
           CASE
             WHEN o.status NOT IN ('delivered','partial','partial_full','partial_item','partial_delivery')
               THEN ('Failed delivery loss (delivery + packaging) - #' || o.order_number)
             WHEN o.status IN ('partial','partial_full','partial_item','partial_delivery')
               THEN ('Partial order profit - #' || o.order_number)
             ELSE ('Order profit - #' || o.order_number)
           END::text AS label,
           (o.customer_name || ' · ' || upper(replace(o.status::text,'_',' ')))::text AS reference,
           o.status::text,
           abs(o.reseller_profit) AS amount,
           o.reseller_profit AS delta
    FROM public.orders o
    WHERE o.reseller_id = _reseller_id
      AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled')
      AND o.reseller_profit <> 0
    UNION ALL
    -- 3. Payouts (PAID only)
    SELECT COALESCE(py.paid_at, py.created_at) AS at, 'payout'::text AS kind,
           'out'::text AS direction,
           'Withdraw paid'::text AS label,
           COALESCE(NULLIF(py.notes,''), NULLIF(py.reference,''), py.method, '-')::text AS reference,
           'paid'::text AS status, py.amount,
           -py.amount::numeric AS delta
    FROM public.payouts py
    WHERE py.reseller_id = _reseller_id
      AND py.status = 'paid'
    UNION ALL
    -- 4. Subscription payments
    SELECT sp.created_at AS at, 'subscription'::text AS kind, 'out'::text AS direction,
           ('Subscription fee - ' || COALESCE(pl.name, 'plan') || ' (' || sp.cycle_months || ' month)')::text AS label,
           COALESCE(NULLIF(sp.reference,''), sp.method, '-')::text AS reference,
           sp.status::text, sp.amount, -sp.amount::numeric AS delta
    FROM public.subscription_payments sp
    LEFT JOIN public.subscription_plans pl ON pl.id = sp.plan_id
    WHERE sp.reseller_id = _reseller_id AND sp.source = 'earning' AND sp.status = 'paid'
  ), ordered AS (
    SELECT ev.*,
           SUM(ev.delta) OVER (ORDER BY ev.at, ev.kind ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
    FROM ev
  )
  SELECT ordered.at, ordered.kind, ordered.direction, ordered.label, ordered.reference,
         ordered.status, ordered.amount, ordered.running
  FROM ordered
  ORDER BY ordered.at DESC
  LIMIT GREATEST(COALESCE(_limit, 200), 1);
END $function$;
REVOKE ALL ON FUNCTION public.reseller_ledger(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reseller_ledger(uuid, integer) TO authenticated;
