-- 1. Order settlement columns
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS returned_qty integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_cost numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settlement_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settled_by uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS damage_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_restored boolean NOT NULL DEFAULT false;

-- migrate legacy 'partial' rows to the explicit partial_full status
UPDATE public.orders SET status = 'partial_full' WHERE status = 'partial';

-- 2. Product cost of the items the customer kept (returned_qty excluded)
CREATE OR REPLACE FUNCTION public.order_kept_product_cost(_order_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH o AS (
    SELECT COALESCE(sa_cost_total,0) - COALESCE(packaging_total,0) AS product_cost
    FROM public.orders WHERE id = _order_id
  ), i AS (
    SELECT COALESCE(SUM(sa_price * quantity),0) AS full_cost,
           COALESCE(SUM(sa_price * GREATEST(quantity - COALESCE(returned_qty,0),0)),0) AS kept_cost
    FROM public.order_items WHERE order_id = _order_id
  )
  SELECT CASE WHEN i.full_cost > 0 THEN ROUND(o.product_cost * (i.kept_cost / i.full_cost), 2)
              ELSE o.product_cost END
  FROM o, i;
$$;

-- 3. Single source of truth for order profit / loss
CREATE OR REPLACE FUNCTION public.sync_order_profit()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_del numeric;      -- admin delivery cost
  v_pack numeric;
  v_recv numeric;
  v_prod numeric;
BEGIN
  v_del := COALESCE(NULLIF(NEW.delivery_cost, 0), NEW.shipping_cost, 0);
  v_pack := COALESCE(NEW.packaging_total, 0);
  v_recv := COALESCE(NEW.received_amount, NEW.total, 0);

  IF NEW.status = 'returned' OR NEW.status = 'pending_return' THEN
    NEW.reseller_profit := -ROUND(v_del + v_pack, 2);
  ELSIF NEW.status = 'cancelled' THEN
    NEW.reseller_profit := 0;
  ELSIF NEW.status = 'partial_delivery' THEN
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack, 2);
  ELSIF NEW.status = 'partial_item' THEN
    IF TG_OP = 'INSERT' THEN
      v_prod := COALESCE(NEW.sa_cost_total,0) - v_pack;
    ELSE
      v_prod := public.order_kept_product_cost(NEW.id);
    END IF;
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack - v_prod, 2);
  ELSIF NEW.status IN ('delivered','partial','partial_full','damaged') THEN
    NEW.reseller_profit := ROUND(v_recv - v_del - v_pack - (COALESCE(NEW.sa_cost_total,0) - v_pack), 2);
  ELSE
    NEW.reseller_profit := ROUND(COALESCE(NEW.total,0) - v_del - COALESCE(NEW.sa_cost_total,0), 2);
  END IF;
  RETURN NEW;
END $$;

-- 4. Stock reversal when items come back
CREATE OR REPLACE FUNCTION public.restore_stock_on_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.stock_restored THEN RETURN NEW; END IF;
  IF NEW.status IN ('returned','cancelled','partial_delivery') THEN
    UPDATE public.products p SET stock = p.stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    NEW.stock_restored := true;
  ELSIF NEW.status = 'partial_item' THEN
    UPDATE public.products p SET stock = p.stock + oi.returned_qty
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id AND COALESCE(oi.returned_qty,0) > 0;
    NEW.stock_restored := true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_restore_stock_on_return ON public.orders;
CREATE TRIGGER trg_restore_stock_on_return
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_return();

-- 5. Realized / lost status sets used by finance functions
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(delivered_profit numeric, pending_payout numeric, paid_out numeric, available numeric, deposit_balance numeric, frozen_amount numeric)
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
    WHERE o.reseller_id=_reseller_id
      AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled')
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
END $$;

-- 6. Transaction report — replaces the old money timeline
CREATE OR REPLACE FUNCTION public.transaction_report(_reseller_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 500)
RETURNS TABLE(
  at timestamptz, kind text, direction text, reseller_id uuid, reseller_name text, reseller_code text,
  order_id uuid, order_number text, status text, label text, note text,
  sell_subtotal numeric, sell_delivery numeric, sell_total numeric,
  buy_product numeric, buy_delivery numeric, packaging numeric, buy_total numeric,
  received numeric, amount numeric, running numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage'])
     AND NOT EXISTS (SELECT 1 FROM public.resellers r WHERE r.id=_reseller_id AND r.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH ev AS (
    SELECT o.updated_at AS at,
           CASE WHEN o.reseller_profit < 0 THEN 'loss' ELSE 'profit' END::text AS kind,
           CASE WHEN o.reseller_profit < 0 THEN 'out' ELSE 'in' END::text AS direction,
           o.reseller_id, r.business_name::text, r.code::text,
           o.id, o.order_number::text, o.status::text,
           ('Order #' || o.order_number || ' is ' || upper(replace(o.status::text,'_',' ')))::text AS label,
           COALESCE(NULLIF(o.settlement_note,''), NULLIF(o.damage_note,''), o.customer_name)::text AS note,
           o.subtotal, o.shipping_cost, o.total,
           CASE WHEN o.status = 'partial_item' THEN public.order_kept_product_cost(o.id)
                WHEN o.status IN ('returned','cancelled','partial_delivery') THEN 0
                ELSE COALESCE(o.sa_cost_total,0) - COALESCE(o.packaging_total,0) END AS buy_product,
           COALESCE(NULLIF(o.delivery_cost,0), o.shipping_cost, 0) AS buy_delivery,
           COALESCE(o.packaging_total,0) AS packaging,
           CASE WHEN o.status IN ('returned','cancelled') THEN 0 ELSE COALESCE(o.received_amount, o.total, 0) END AS received,
           abs(o.reseller_profit) AS amount,
           o.reseller_profit AS delta
    FROM public.orders o JOIN public.resellers r ON r.id = o.reseller_id
    WHERE (_reseller_id IS NULL OR o.reseller_id = _reseller_id)
      AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned')
      AND o.reseller_profit <> 0
      AND (_from IS NULL OR o.updated_at >= _from) AND (_to IS NULL OR o.updated_at < _to)
    UNION ALL
    SELECT rd.created_at, 'deposit', 'in', rd.reseller_id, r.business_name::text, r.code::text,
           NULL::uuid, NULL::text, 'confirmed', 'Security deposit'::text,
           COALESCE(NULLIF(rd.note,''), NULLIF(rd.reference,''), rd.method, '—')::text,
           0,0,0,0,0,0, rd.amount, rd.amount, rd.amount::numeric
    FROM public.reseller_deposits rd JOIN public.resellers r ON r.id = rd.reseller_id
    WHERE (_reseller_id IS NULL OR rd.reseller_id = _reseller_id)
      AND (_from IS NULL OR rd.created_at >= _from) AND (_to IS NULL OR rd.created_at < _to)
    UNION ALL
    SELECT py.created_at, 'withdraw',
           CASE WHEN py.status = 'rejected' THEN 'void' ELSE 'out' END,
           py.reseller_id, r.business_name::text, r.code::text,
           NULL::uuid, NULL::text, py.status::text, 'Withdraw request'::text,
           COALESCE(NULLIF(py.notes,''), NULLIF(py.reference,''), '—')::text,
           0,0,0,0,0,0, 0, py.amount,
           CASE WHEN py.status = 'rejected' THEN 0 ELSE -py.amount END
    FROM public.payouts py JOIN public.resellers r ON r.id = py.reseller_id
    WHERE (_reseller_id IS NULL OR py.reseller_id = _reseller_id)
      AND (_from IS NULL OR py.created_at >= _from) AND (_to IS NULL OR py.created_at < _to)
  ), ordered AS (
    SELECT ev.*,
           SUM(ev.delta) OVER (PARTITION BY ev.reseller_id ORDER BY ev.at ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run
    FROM ev
  )
  SELECT ordered.at, ordered.kind, ordered.direction, ordered.reseller_id, ordered.business_name, ordered.code,
         ordered.id, ordered.order_number, ordered.status, ordered.label, ordered.note,
         ordered.subtotal, ordered.shipping_cost, ordered.total,
         ordered.buy_product, ordered.buy_delivery, ordered.packaging,
         ordered.buy_product + ordered.buy_delivery + ordered.packaging,
         ordered.received, ordered.amount, ordered.run
  FROM ordered
  ORDER BY ordered.at DESC
  LIMIT GREATEST(COALESCE(_limit, 500), 1);
END $$;

REVOKE EXECUTE ON FUNCTION public.transaction_report(uuid, timestamptz, timestamptz, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.order_kept_product_cost(uuid) FROM anon;