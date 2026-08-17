DROP FUNCTION IF EXISTS public.reseller_profit_summary(uuid);
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    SELECT COALESCE(frozen_amount,0) AS frozen FROM public.resellers WHERE id=_reseller_id
  ), dep AS (
    SELECT COALESCE(SUM(amount),0) AS bal FROM public.reseller_deposits WHERE reseller_id=_reseller_id
  )
  SELECT d.amt, p.pending, p.paid,
         GREATEST(d.amt + dep.bal - p.pending - p.paid - f.frozen, 0),
         dep.bal, f.frozen
  FROM d,p,f,dep;
END $function$;

CREATE OR REPLACE FUNCTION public.enforce_payout_freeze()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_frozen numeric; v_delivered numeric; v_pending numeric; v_paid numeric; v_avail numeric; v_dep numeric;
BEGIN
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_any_permission(auth.uid(), ARRAY['payouts.manage','finance.view']) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(frozen_amount,0) INTO v_frozen FROM public.resellers WHERE id = NEW.reseller_id;
  SELECT COALESCE(SUM(reseller_profit),0) INTO v_delivered FROM public.orders
    WHERE reseller_id = NEW.reseller_id AND status = 'delivered';
  SELECT COALESCE(SUM(amount),0) INTO v_dep FROM public.reseller_deposits WHERE reseller_id = NEW.reseller_id;
  SELECT COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0),
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),0)
    INTO v_pending, v_paid FROM public.payouts WHERE reseller_id = NEW.reseller_id AND id <> NEW.id;

  v_avail := GREATEST(v_delivered + v_dep - v_pending - v_paid - COALESCE(v_frozen,0), 0);
  IF NEW.amount > v_avail THEN
    RAISE EXCEPTION 'Withdraw limit: sorbocho %.2f BDT tola jabe (%.2f BDT freeze kora ache).', v_avail, COALESCE(v_frozen,0);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_reseller_metrics()
RETURNS TABLE(reseller_id uuid, orders bigint, delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
         GREATEST(COALESCE(o.delivered_profit,0)+COALESCE(d.deposit_balance,0)-COALESCE(p.pending_payout,0)-COALESCE(p.paid_out,0)-COALESCE(r.frozen_amount,0),0),
         COALESCE(d.deposit_balance,0), COALESCE(r.frozen_amount,0)
  FROM public.resellers r
  LEFT JOIN o ON o.reseller_id=r.id
  LEFT JOIN p ON p.reseller_id=r.id
  LEFT JOIN d ON d.reseller_id=r.id
  WHERE public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage']);
$function$;

CREATE OR REPLACE FUNCTION public.reseller_ledger(_reseller_id uuid, _limit int DEFAULT 200)
RETURNS TABLE(at timestamptz, kind text, direction text, label text, reference text, status text, amount numeric, running numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
           'সিকিউরিটি ডিপোজিট জমা'::text AS label,
           COALESCE(NULLIF(rd.reference,''), rd.method, '—')::text AS reference,
           'confirmed'::text AS status, rd.amount::numeric AS amount,
           rd.amount::numeric AS delta
    FROM public.reseller_deposits rd WHERE rd.reseller_id = _reseller_id
    UNION ALL
    SELECT o.updated_at, 'profit', 'in',
           ('অর্ডার প্রফিট · #' || o.order_number),
           o.customer_name, o.status::text, o.reseller_profit, o.reseller_profit
    FROM public.orders o
    WHERE o.reseller_id = _reseller_id AND o.status = 'delivered' AND o.reseller_profit <> 0
    UNION ALL
    SELECT py.created_at, 'payout',
           CASE WHEN py.status = 'rejected' THEN 'void' ELSE 'out' END,
           'উইথড্র রিকোয়েস্ট', COALESCE(py.reference, py.notes, '—'), py.status::text, py.amount,
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

GRANT EXECUTE ON FUNCTION public.reseller_ledger(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) TO authenticated;