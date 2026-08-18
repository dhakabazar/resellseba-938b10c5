-- 1. New money fields on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS received_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS packaging_total numeric(12,2) NOT NULL DEFAULT 0;

-- 2. Keep packaging_total in sync from order items
CREATE OR REPLACE FUNCTION public.recalc_order_packaging(_order_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.orders o
  SET packaging_total = COALESCE((
    SELECT SUM(COALESCE(p.packaging_cost,0) * oi.quantity)
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id
  ), 0)
  WHERE o.id = _order_id;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_packaging()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.recalc_order_packaging(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_order_packaging ON public.order_items;
CREATE TRIGGER trg_sync_order_packaging
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.sync_order_packaging();

-- 3. Profit is now settlement aware:
--    delivered/partial -> received - delivery - (product + packaging)
--    returned/cancelled -> loss of delivery + packaging (product comes back)
--    still running      -> expected profit from the order total
CREATE OR REPLACE FUNCTION public.sync_order_profit()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('returned','cancelled') THEN
    NEW.reseller_profit := -ROUND(COALESCE(NEW.shipping_cost,0) + COALESCE(NEW.packaging_total,0), 2);
  ELSIF NEW.status = 'delivered' THEN
    NEW.reseller_profit := ROUND(COALESCE(NEW.received_amount, NEW.total, 0)
      - COALESCE(NEW.shipping_cost,0) - COALESCE(NEW.sa_cost_total,0), 2);
  ELSE
    NEW.reseller_profit := ROUND(COALESCE(NEW.total,0) - COALESCE(NEW.shipping_cost,0) - COALESCE(NEW.sa_cost_total,0), 2);
  END IF;
  RETURN NEW;
END $$;

-- 4. Backfill packaging + profit for existing orders
UPDATE public.orders o
SET packaging_total = COALESCE((
  SELECT SUM(COALESCE(p.packaging_cost,0) * oi.quantity)
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = o.id
), 0);

UPDATE public.orders SET updated_at = updated_at;

-- 5. Settled money = delivered profit + failed-delivery losses
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
    WHERE o.reseller_id=_reseller_id AND o.status IN ('delivered','returned','cancelled')
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

CREATE OR REPLACE FUNCTION public.admin_reseller_metrics()
 RETURNS TABLE(reseller_id uuid, orders bigint, delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT o.reseller_id,
           COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status IN ('delivered','returned','cancelled') THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
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
    WHERE reseller_id = NEW.reseller_id AND status IN ('delivered','returned','cancelled');
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

-- 6. Timeline shows partial profit and failed-delivery loss too
CREATE OR REPLACE FUNCTION public.reseller_ledger(_reseller_id uuid, _limit integer DEFAULT 200)
 RETURNS TABLE(at timestamp with time zone, kind text, direction text, label text, reference text, status text, amount numeric, running numeric)
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
           'Security deposit'::text AS label,
           COALESCE(NULLIF(rd.reference,''), rd.method, '—')::text AS reference,
           'confirmed'::text AS status, rd.amount::numeric AS amount,
           rd.amount::numeric AS delta
    FROM public.reseller_deposits rd WHERE rd.reseller_id = _reseller_id
    UNION ALL
    SELECT o.updated_at,
           CASE WHEN o.status = 'delivered' THEN 'profit' ELSE 'loss' END,
           CASE WHEN o.reseller_profit < 0 THEN 'out' ELSE 'in' END,
           CASE
             WHEN o.status <> 'delivered'
               THEN ('Failed delivery loss (delivery + packaging) · #' || o.order_number)
             WHEN o.received_amount IS NOT NULL AND o.received_amount < o.total
               THEN ('Partial order profit · #' || o.order_number)
             ELSE ('Order profit · #' || o.order_number)
           END,
           CASE
             WHEN o.received_amount IS NOT NULL AND o.received_amount < o.total
               THEN (o.customer_name || ' · received ' || round(o.received_amount)::text || ' of ' || round(o.total)::text)
             ELSE o.customer_name
           END,
           o.status::text,
           abs(o.reseller_profit),
           o.reseller_profit
    FROM public.orders o
    WHERE o.reseller_id = _reseller_id
      AND o.status IN ('delivered','returned','cancelled')
      AND o.reseller_profit <> 0
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