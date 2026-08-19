DROP FUNCTION IF EXISTS public.transaction_report(uuid, timestamptz, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.transaction_report(_reseller_id uuid, _from timestamp with time zone, _to timestamp with time zone, _limit integer DEFAULT 500)
 RETURNS TABLE(at timestamp with time zone, kind text, direction text, reseller_id uuid, reseller_name text, reseller_code text, order_id uuid, order_number text, status text, label text, note text, sell_subtotal numeric, sell_delivery numeric, sell_total numeric, buy_product numeric, buy_delivery numeric, packaging numeric, buy_total numeric, received numeric, advance numeric, advance_by text, amount numeric, running numeric)
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
    SELECT o.updated_at AS at,
           CASE WHEN o.reseller_profit < 0 THEN 'loss' ELSE 'profit' END::text AS kind,
           CASE WHEN o.reseller_profit < 0 THEN 'out' ELSE 'in' END::text AS direction,
           o.reseller_id, r.business_name::text, r.code::text,
           o.id, o.order_number::text, o.status::text,
           ('Order #' || o.order_number || ' is ' || upper(replace(o.status::text,'_',' ')))::text AS label,
           (
             o.customer_name
             || CASE o.status::text
                  WHEN 'delivered' THEN ' · full delivery, courier collected ' || round(COALESCE(o.received_amount, o.total, 0))::text
                  WHEN 'partial_full' THEN ' · partial (full item) — collected ' || round(COALESCE(o.received_amount,0))::text || ' of ' || round(COALESCE(o.total,0))::text
                  WHEN 'partial_item' THEN ' · partial (item ferot) — collected ' || round(COALESCE(o.received_amount,0))::text || ', kept item cost dhora hoyeche'
                  WHEN 'partial_delivery' THEN ' · partial (only delivery charge) — collected ' || round(COALESCE(o.received_amount,0))::text || ', product ferot'
                  WHEN 'returned' THEN ' · parcel ferot — delivery + packaging loss'
                  WHEN 'damaged' THEN ' · damaged/missing item — collected ' || round(COALESCE(o.received_amount,0))::text
                  ELSE ' · ' || replace(o.status::text,'_',' ')
                END
             || CASE WHEN COALESCE(o.advance_amount,0) > 0
                     THEN ' · advance ' || round(o.advance_amount)::text || ' (' || COALESCE(o.advance_by,'reseller') || ')'
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
           CASE WHEN o.status IN ('returned','cancelled') THEN 0 ELSE COALESCE(o.received_amount, o.total, 0) END AS received,
           COALESCE(o.advance_amount,0) AS advance,
           COALESCE(o.advance_by,'reseller')::text AS advance_by,
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
           ('Security deposit jomma' || COALESCE(' · ' || NULLIF(rd.method,''), '')
             || COALESCE(' · ref ' || NULLIF(rd.reference,''), '')
             || COALESCE(' · ' || NULLIF(rd.note,''), ''))::text,
           0,0,0,0,0,0, rd.amount, 0, NULL::text, rd.amount, rd.amount::numeric
    FROM public.reseller_deposits rd JOIN public.resellers r ON r.id = rd.reseller_id
    WHERE (_reseller_id IS NULL OR rd.reseller_id = _reseller_id)
      AND (_from IS NULL OR rd.created_at >= _from) AND (_to IS NULL OR rd.created_at < _to)
    UNION ALL
    SELECT py.created_at, 'withdraw',
           CASE WHEN py.status = 'rejected' THEN 'void' ELSE 'out' END,
           py.reseller_id, r.business_name::text, r.code::text,
           NULL::uuid, NULL::text, py.status::text, 'Withdraw request'::text,
           ('Withdraw ' || py.status::text
             || COALESCE(' · ' || NULLIF(py.method::text,''), '')
             || COALESCE(' · ref ' || NULLIF(py.reference,''), '')
             || COALESCE(' · ' || NULLIF(py.notes,''), ''))::text,
           0,0,0,0,0,0, 0, 0, NULL::text, py.amount,
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
         ordered.received, ordered.advance, ordered.advance_by, ordered.amount, ordered.run
  FROM ordered
  ORDER BY ordered.at DESC
  LIMIT GREATEST(COALESCE(_limit, 500), 1);
END $function$;