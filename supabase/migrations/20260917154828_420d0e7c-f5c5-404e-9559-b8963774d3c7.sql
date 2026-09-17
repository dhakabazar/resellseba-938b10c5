CREATE OR REPLACE FUNCTION public.admin_payout_overview(
  _search text DEFAULT NULL,
  _sort text DEFAULT 'available',
  _dir text DEFAULT 'desc',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _active_only boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows jsonb;
  v_total integer;
  v_sum jsonb;
  v_sort text;
  v_dir text;
  v_q text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_any_permission(auth.uid(), ARRAY['payouts.manage','finance.view','reports.view','dashboard.view']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_sort := CASE lower(coalesce(_sort,'available'))
    WHEN 'business_name' THEN 'business_name'
    WHEN 'delivered_profit' THEN 'delivered_profit'
    WHEN 'deposit_balance' THEN 'deposit_balance'
    WHEN 'frozen_amount' THEN 'frozen_amount'
    WHEN 'requests_count' THEN 'requests_count'
    WHEN 'requested_total' THEN 'requested_total'
    WHEN 'pending_amount' THEN 'pending_amount'
    WHEN 'approved_amount' THEN 'approved_amount'
    WHEN 'paid_out' THEN 'paid_out'
    WHEN 'rejected_amount' THEN 'rejected_amount'
    WHEN 'last_request_at' THEN 'last_request_at'
    ELSE 'available' END;
  v_dir := CASE WHEN lower(coalesce(_dir,'desc')) = 'asc' THEN 'ASC' ELSE 'DESC' END;
  v_q := nullif(btrim(coalesce(_search,'')), '');

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
    FROM public.payouts py GROUP BY py.reseller_id
  ), dep AS (
    SELECT rd.reseller_id AS rid, COALESCE(SUM(rd.amount),0) AS bal
    FROM public.reseller_deposits rd GROUP BY rd.reseller_id
  ), base AS (
    SELECT r.id AS reseller_id, r.code, r.business_name,
      COALESCE(r.contact_phone, p.phone) AS owner_phone,
      COALESCE(prof.amt,0) AS delivered_profit,
      COALESCE(dep.bal,0) AS deposit_balance,
      COALESCE(r.frozen_amount,0) AS frozen_amount,
      COALESCE(pay.cnt,0) AS requests_count,
      COALESCE(pay.total,0) AS requested_total,
      COALESCE(pay.pend,0) AS pending_amount,
      COALESCE(pay.appr,0) AS approved_amount,
      COALESCE(pay.paid,0) AS paid_out,
      COALESCE(pay.rej,0) AS rejected_amount,
      GREATEST(COALESCE(prof.amt,0) + COALESCE(dep.bal,0) - COALESCE(pay.pend,0) - COALESCE(pay.appr,0) - COALESCE(pay.paid,0) - COALESCE(r.frozen_amount,0), 0) AS available,
      pay.last_at AS last_request_at
    FROM public.resellers r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN prof ON prof.rid = r.id
    LEFT JOIN pay ON pay.rid = r.id
    LEFT JOIN dep ON dep.rid = r.id
  ), filt AS (
    SELECT * FROM base b
    WHERE (NOT _active_only
           OR b.delivered_profit <> 0 OR b.deposit_balance <> 0 OR b.frozen_amount <> 0
           OR b.requests_count > 0 OR b.available <> 0)
      AND (v_q IS NULL
           OR coalesce(b.business_name,'') ILIKE '%'||v_q||'%'
           OR coalesce(b.code,'') ILIKE '%'||v_q||'%'
           OR coalesce(b.owner_phone,'') ILIKE '%'||v_q||'%')
  )
  SELECT
    (SELECT count(*)::int FROM filt),
    (SELECT jsonb_build_object(
        'profit', COALESCE(SUM(delivered_profit),0),
        'deposit', COALESCE(SUM(deposit_balance),0),
        'requested', COALESCE(SUM(requested_total),0),
        'pending', COALESCE(SUM(pending_amount) + SUM(approved_amount),0),
        'paid', COALESCE(SUM(paid_out),0),
        'available', COALESCE(SUM(available),0)
      ) FROM filt),
    (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
        SELECT * FROM filt
        ORDER BY
          CASE WHEN v_sort='business_name' AND v_dir='ASC' THEN business_name END ASC NULLS LAST,
          CASE WHEN v_sort='business_name' AND v_dir='DESC' THEN business_name END DESC NULLS LAST,
          CASE WHEN v_sort='delivered_profit' AND v_dir='ASC' THEN delivered_profit END ASC NULLS LAST,
          CASE WHEN v_sort='delivered_profit' AND v_dir='DESC' THEN delivered_profit END DESC NULLS LAST,
          CASE WHEN v_sort='deposit_balance' AND v_dir='ASC' THEN deposit_balance END ASC NULLS LAST,
          CASE WHEN v_sort='deposit_balance' AND v_dir='DESC' THEN deposit_balance END DESC NULLS LAST,
          CASE WHEN v_sort='frozen_amount' AND v_dir='ASC' THEN frozen_amount END ASC NULLS LAST,
          CASE WHEN v_sort='frozen_amount' AND v_dir='DESC' THEN frozen_amount END DESC NULLS LAST,
          CASE WHEN v_sort='requests_count' AND v_dir='ASC' THEN requests_count END ASC NULLS LAST,
          CASE WHEN v_sort='requests_count' AND v_dir='DESC' THEN requests_count END DESC NULLS LAST,
          CASE WHEN v_sort='requested_total' AND v_dir='ASC' THEN requested_total END ASC NULLS LAST,
          CASE WHEN v_sort='requested_total' AND v_dir='DESC' THEN requested_total END DESC NULLS LAST,
          CASE WHEN v_sort='pending_amount' AND v_dir='ASC' THEN pending_amount END ASC NULLS LAST,
          CASE WHEN v_sort='pending_amount' AND v_dir='DESC' THEN pending_amount END DESC NULLS LAST,
          CASE WHEN v_sort='approved_amount' AND v_dir='ASC' THEN approved_amount END ASC NULLS LAST,
          CASE WHEN v_sort='approved_amount' AND v_dir='DESC' THEN approved_amount END DESC NULLS LAST,
          CASE WHEN v_sort='paid_out' AND v_dir='ASC' THEN paid_out END ASC NULLS LAST,
          CASE WHEN v_sort='paid_out' AND v_dir='DESC' THEN paid_out END DESC NULLS LAST,
          CASE WHEN v_sort='rejected_amount' AND v_dir='ASC' THEN rejected_amount END ASC NULLS LAST,
          CASE WHEN v_sort='rejected_amount' AND v_dir='DESC' THEN rejected_amount END DESC NULLS LAST,
          CASE WHEN v_sort='last_request_at' AND v_dir='ASC' THEN last_request_at END ASC NULLS LAST,
          CASE WHEN v_sort='last_request_at' AND v_dir='DESC' THEN last_request_at END DESC NULLS LAST,
          CASE WHEN v_sort='available' AND v_dir='ASC' THEN available END ASC NULLS LAST,
          CASE WHEN v_sort='available' AND v_dir='DESC' THEN available END DESC NULLS LAST,
          business_name ASC
        LIMIT GREATEST(LEAST(COALESCE(_limit,50), 500), 1)
        OFFSET GREATEST(COALESCE(_offset,0), 0)
      ) t)
  INTO v_total, v_sum, v_rows;

  RETURN jsonb_build_object('total', v_total, 'totals', v_sum, 'rows', v_rows);
END $function$;