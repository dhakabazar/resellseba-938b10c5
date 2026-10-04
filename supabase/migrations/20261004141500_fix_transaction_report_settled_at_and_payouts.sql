-- 1. Ensure settled_at is populated for all existing settled orders so nothing is lost
UPDATE public.orders
SET settled_at = updated_at
WHERE settled_at IS NULL
  AND status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned');

-- 2. Trigger to manage settled_at automatically across status changes
CREATE OR REPLACE FUNCTION public.sync_order_settled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned') THEN
    IF OLD.status IS NULL
       OR OLD.status NOT IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned')
       OR NEW.settled_at IS NULL THEN
      NEW.settled_at := COALESCE(NEW.settled_at, now());
    END IF;
  ELSE
    NEW.settled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_settled_at ON public.orders;
CREATE TRIGGER trg_order_settled_at
BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.sync_order_settled_at();

-- 3. Update transaction_report to use immutable settled_at (with updated_at fallback) and paid payouts
CREATE OR REPLACE FUNCTION public.transaction_report(_reseller_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer DEFAULT 500)
 RETURNS TABLE(at timestamp with time zone, kind text, direction text, reseller_id uuid, reseller_name text, reseller_code text, order_id uuid, order_number text, status text, label text, note text, sell_subtotal numeric, sell_delivery numeric, sell_total numeric, buy_product numeric, buy_delivery numeric, packaging numeric, buy_total numeric, collected numeric, received numeric, advance numeric, advance_by text, amount numeric, running numeric)
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
    SELECT COALESCE(o.settled_at, o.updated_at) AS at,
           CASE WHEN o.reseller_profit < 0 THEN 'loss' ELSE 'profit' END::text AS kind,
           CASE WHEN o.reseller_profit < 0 THEN 'out' ELSE 'in' END::text AS direction,
           o.reseller_id, COALESCE(r.business_name, 'Admin direct order')::text AS business_name,
           COALESCE(r.code, 'ADMIN')::text AS code,
           o.id, o.order_number::text, o.status::text,
           ('Order #' || o.order_number || ' is ' || upper(replace(o.status::text,'_',' ')))::text AS label,
           (
             o.customer_name
             || CASE o.status::text
                  WHEN 'delivered' THEN ' · full delivery, courier collected ' || round(COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - COALESCE(o.advance_amount,0), 0)))::text
                  WHEN 'partial_full' THEN ' · partial (full item) — collected ' || round(COALESCE(o.received_amount,0))::text || ' of ' || round(COALESCE(o.total,0))::text
                  WHEN 'partial_item' THEN ' · partial (items returned) — collected ' || round(COALESCE(o.received_amount,0))::text || ', only the kept items are charged'
                  WHEN 'partial_delivery' THEN ' · partial (delivery charge only) — collected ' || round(COALESCE(o.received_amount,0))::text || ', product returned'
                  WHEN 'returned' THEN ' · parcel returned — delivery + packaging loss'
                  WHEN 'damaged' THEN ' · damaged/missing item — collected ' || round(COALESCE(o.received_amount,0))::text
                  ELSE ' · ' || replace(o.status::text,'_',' ')
                END
             || CASE WHEN o.reseller_id IS NULL THEN ' · admin direct order' ELSE '' END
             || CASE WHEN COALESCE(o.advance_amount,0) > 0
                     THEN ' · advance ' || round(o.advance_amount)::text || ' already paid (held by ' || COALESCE(o.advance_by,'reseller') || ')'
                          || CASE WHEN COALESCE(o.advance_by,'reseller') = 'reseller'
                                  THEN ' — deducted from the reseller balance'
                                  ELSE ' — kept by admin, balance unchanged' END
                     ELSE '' END
             || COALESCE(' · ' || NULLIF(o.settlement_note,''), '')
             || COALESCE(' · ' || NULLIF(o.damage_note,''), '')
           )::text AS note,
           o.subtotal, o.shipping_cost, o.total,
           CASE WHEN o.status = 'partial_item' THEN public.order_kept_product_cost(o.id)
                WHEN o.status IN ('returned','cancelled','partial_delivery') THEN 0
                ELSE COALESCE(o.sa_cost_total,0) - COALESCE(o.packaging_total,0) END AS buy_product,
           COALESCE(NULLIF(o.delivery_cost,0), o.shipping_cost, 0) AS buy_delivery,
           COALESCE(o.packaging_total,0) AS packaging,
           CASE WHEN o.status IN ('returned','cancelled') THEN 0
                ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - COALESCE(o.advance_amount,0), 0)) END AS collected,
           CASE WHEN o.status IN ('returned','cancelled') THEN 0
                ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - COALESCE(o.advance_amount,0), 0)) + COALESCE(o.advance_amount,0) END AS received,
           COALESCE(o.advance_amount,0) AS advance,
           COALESCE(o.advance_by,'reseller')::text AS advance_by,
           abs(o.reseller_profit) AS amount,
           o.reseller_profit AS delta
    FROM public.orders o LEFT JOIN public.resellers r ON r.id = o.reseller_id
    WHERE (_reseller_id IS NULL OR o.reseller_id = _reseller_id)
      AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned')
      AND o.reseller_profit <> 0
      AND (_from IS NULL OR COALESCE(o.settled_at, o.updated_at) >= _from)
      AND (_to IS NULL OR COALESCE(o.settled_at, o.updated_at) <= _to)
    UNION ALL
    SELECT rd.created_at, 'deposit', 'in', rd.reseller_id, r.business_name::text, r.code::text,
           NULL::uuid, NULL::text, 'confirmed', 'Security deposit'::text,
           ('Security deposit received' || COALESCE(' · ' || NULLIF(rd.method,''), '')
             || COALESCE(' · ref ' || NULLIF(rd.reference,''), '')
             || COALESCE(' · ' || NULLIF(rd.note,''), ''))::text,
           0,0,0,0,0,0, rd.amount, rd.amount, 0, NULL::text, rd.amount, rd.amount::numeric
    FROM public.reseller_deposits rd JOIN public.resellers r ON r.id = rd.reseller_id
    WHERE (_reseller_id IS NULL OR rd.reseller_id = _reseller_id)
      AND (_from IS NULL OR rd.created_at >= _from) AND (_to IS NULL OR rd.created_at <= _to)
    UNION ALL
    SELECT COALESCE(py.paid_at, py.created_at) AS at, 'withdraw',
           'out'::text,
           py.reseller_id, r.business_name::text, r.code::text,
           NULL::uuid, NULL::text, 'paid'::text, 'Withdraw paid'::text,
           ('Withdraw paid'
             || COALESCE(' · ' || NULLIF(py.method::text,''), '')
             || COALESCE(' · ref ' || NULLIF(py.reference,''), '')
             || COALESCE(' · ' || NULLIF(py.notes,''), ''))::text,
           0,0,0,0,0,0, 0, 0, 0, NULL::text, py.amount,
           -py.amount::numeric AS delta
    FROM public.payouts py JOIN public.resellers r ON r.id = py.reseller_id
    WHERE (_reseller_id IS NULL OR py.reseller_id = _reseller_id)
      AND py.status = 'paid'
      AND (_from IS NULL OR COALESCE(py.paid_at, py.created_at) >= _from)
      AND (_to IS NULL OR COALESCE(py.paid_at, py.created_at) <= _to)
  ), ordered AS (
    SELECT ev.*,
           SUM(ev.delta) OVER (PARTITION BY ev.reseller_id ORDER BY ev.at, ev.order_number NULLS LAST, ev.id NULLS LAST ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS run
    FROM ev
  )
  SELECT ordered.at, ordered.kind, ordered.direction, ordered.reseller_id, ordered.business_name, ordered.code,
         ordered.id, ordered.order_number, ordered.status, ordered.label, ordered.note,
         ordered.subtotal, ordered.shipping_cost, ordered.total,
         ordered.buy_product, ordered.buy_delivery, ordered.packaging,
         ordered.buy_product + ordered.buy_delivery + ordered.packaging,
         ordered.collected, ordered.received, ordered.advance, ordered.advance_by, ordered.amount, ordered.run
  FROM ordered
  ORDER BY ordered.at DESC, ordered.order_number DESC NULLS LAST, ordered.id DESC NULLS LAST
  LIMIT GREATEST(COALESCE(_limit, 500), 1);
END $function$;

-- 4. Unify admin_payout_report with complete status set and consistent payout dates
CREATE OR REPLACE FUNCTION public.admin_payout_report()
 RETURNS TABLE(reseller_id uuid, code text, business_name text, status text, payout_method text, payout_account_number text, earned_profit numeric, deposit_balance numeric, frozen_amount numeric, pending_payout numeric, approved_payout numeric, paid_out numeric, rejected_payout numeric, due_balance numeric, last_request_at timestamp with time zone, last_paid_at timestamp with time zone, request_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage','resellers.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH prof AS (
    SELECT o.reseller_id AS rid, COALESCE(SUM(o.reseller_profit),0) AS amt
    FROM public.orders o
    WHERE o.reseller_id IS NOT NULL
      AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled')
    GROUP BY o.reseller_id
  ), pay AS (
    SELECT py.reseller_id AS rid,
           COALESCE(SUM(CASE WHEN py.status = 'pending' THEN py.amount ELSE 0 END),0) AS pending,
           COALESCE(SUM(CASE WHEN py.status = 'approved' THEN py.amount ELSE 0 END),0) AS approved,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END),0) AS paid,
           COALESCE(SUM(CASE WHEN py.status = 'rejected' THEN py.amount ELSE 0 END),0) AS rejected,
           MAX(py.created_at) AS last_req,
           MAX(COALESCE(py.paid_at, py.created_at)) AS last_paid,
           COUNT(*)::int AS cnt
    FROM public.payouts py
    GROUP BY py.reseller_id
  ), dep AS (
    SELECT rd.reseller_id AS rid, COALESCE(SUM(rd.amount),0) AS bal
    FROM public.reseller_deposits rd
    GROUP BY rd.reseller_id
  )
  SELECT r.id, r.code, r.business_name, r.status::text, r.payout_method, r.payout_account_number,
         COALESCE(prof.amt,0), COALESCE(dep.bal,0), COALESCE(r.frozen_amount,0),
         COALESCE(pay.pending,0), COALESCE(pay.approved,0), COALESCE(pay.paid,0), COALESCE(pay.rejected,0),
         (COALESCE(prof.amt,0) + COALESCE(dep.bal,0)
           - COALESCE(pay.pending,0) - COALESCE(pay.approved,0)
           - COALESCE(pay.paid,0) - COALESCE(r.frozen_amount,0)),
         pay.last_req, pay.last_paid, COALESCE(pay.cnt,0)
  FROM public.resellers r
  LEFT JOIN prof ON prof.rid = r.id
  LEFT JOIN pay ON pay.rid = r.id
  LEFT JOIN dep ON dep.rid = r.id
  WHERE COALESCE(prof.amt,0) <> 0 OR pay.rid IS NOT NULL OR COALESCE(dep.bal,0) <> 0;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_payout_report() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_payout_report() TO authenticated;

-- 5. Unify admin_resellers_page with all realized & returned statuses
CREATE OR REPLACE FUNCTION public.admin_resellers_page()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_any_permission(auth.uid(), ARRAY['resellers.manage','payouts.manage','finance.view','reports.view']) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH o AS (
    SELECT reseller_id, COUNT(*)::bigint orders,
      COALESCE(SUM(CASE WHEN status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled') THEN reseller_profit ELSE 0 END),0) dp
    FROM orders GROUP BY reseller_id
  ), p AS (
    SELECT reseller_id,
      COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0) pp,
      COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) po
    FROM payouts GROUP BY reseller_id
  ), d AS (
    SELECT reseller_id, COALESCE(SUM(amount),0) db FROM reseller_deposits GROUP BY reseller_id
  )
  SELECT jsonb_build_object(
    'resellers', COALESCE((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
      SELECT rs.id,rs.user_id,rs.avatar_url,rs.business_name,rs.code,rs.contact_phone,rs.address,rs.nid_number,rs.status,
        rs.commission_rate,rs.leader_id,rs.agent_id,rs.notes,rs.approved_at,rs.created_at,rs.payout_method,rs.payout_account_name,
        rs.payout_account_number,rs.payout_bank_name,rs.payout_branch,rs.payout_routing,rs.deposit_required,
        rs.deposit_required_amount,rs.frozen_amount,
        COALESCE(o.orders,0) m_orders, COALESCE(o.dp,0) m_dp, COALESCE(p.pp,0) m_pp, COALESCE(p.po,0) m_po,
        COALESCE(d.db,0) m_db,
        (COALESCE(o.dp,0)+COALESCE(d.db,0)-COALESCE(p.pp,0)-COALESCE(p.po,0)-COALESCE(rs.frozen_amount,0)) m_av,
        pr.email_verified_at IS NOT NULL p_email, pr.phone_verified_at IS NOT NULL p_phone,
        u.email a_email, u.email_confirmed_at IS NOT NULL a_confirmed
      FROM resellers rs
      LEFT JOIN o ON o.reseller_id=rs.id
      LEFT JOIN p ON p.reseller_id=rs.id
      LEFT JOIN d ON d.reseller_id=rs.id
      LEFT JOIN profiles pr ON pr.id=rs.user_id
      LEFT JOIN auth.users u ON u.id=rs.user_id
    ) x), '[]'::jsonb),
    'agents', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'display_name',display_name) ORDER BY display_name) FROM agents), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_resellers_page() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resellers_page() TO authenticated;

-- 6. Unify reseller_profit_summary
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id uuid)
RETURNS TABLE(
  delivered_profit numeric,
  deposit_balance numeric,
  frozen_amount numeric,
  pending_payout numeric,
  paid_out numeric,
  available numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dp numeric := 0;
  v_db numeric := 0;
  v_fa numeric := 0;
  v_pp numeric := 0;
  v_po numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','finance.view','reports.view','payouts.manage','resellers.manage'])
     AND NOT EXISTS (SELECT 1 FROM public.resellers r WHERE r.id = _reseller_id AND r.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(SUM(o.reseller_profit), 0) INTO v_dp
  FROM public.orders o
  WHERE o.reseller_id = _reseller_id
    AND o.status IN ('delivered','partial','partial_full','partial_item','partial_delivery','damaged','returned','cancelled');

  SELECT COALESCE(SUM(rd.amount), 0) INTO v_db
  FROM public.reseller_deposits rd
  WHERE rd.reseller_id = _reseller_id;

  SELECT COALESCE(r.frozen_amount, 0) INTO v_fa
  FROM public.resellers r
  WHERE r.id = _reseller_id;

  SELECT
    COALESCE(SUM(CASE WHEN py.status IN ('pending', 'approved') THEN py.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0)
  INTO v_pp, v_po
  FROM public.payouts py
  WHERE py.reseller_id = _reseller_id;

  RETURN QUERY SELECT
    v_dp,
    v_db,
    v_fa,
    v_pp,
    v_po,
    (v_dp + v_db - v_pp - v_po - v_fa) AS available;
END;
$$;
REVOKE ALL ON FUNCTION public.reseller_profit_summary(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(uuid) TO authenticated;
