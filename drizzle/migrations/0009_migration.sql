
-- Fast first page: every list RPC accepts an optional row limit; the client loads
-- the first page instantly, then the full set in the background.
DROP FUNCTION IF EXISTS public.admin_orders_page(text[], bigint, bigint);
CREATE FUNCTION public.admin_orders_page(_statuses text[] DEFAULT NULL, _from_ts bigint DEFAULT NULL, _to_ts bigint DEFAULT NULL, _limit integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_orders jsonb; v_ids uuid[]; v_items jsonb; v_ship jsonb; v_counts jsonb; v_resellers jsonb;
  v_from timestamptz := case when _from_ts is null then null else to_timestamp(_from_ts / 1000.0) end;
  v_to timestamptz := case when _to_ts is null then null else to_timestamp(_to_ts / 1000.0) end;
begin
  if not public.has_any_permission(auth.uid(), '{orders.view,orders.edit,orders.create,orders.delete,orders.status,orders.ship}'::text[]) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(row order by ca desc), '[]'::jsonb), coalesce(array_agg(id), '{}'::uuid[])
    into v_orders, v_ids
  from (
    select o.id, o.created_at as ca,
           jsonb_build_object(
             'id', o.id, 'reseller_id', o.reseller_id, 'order_number', o.order_number,
             'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
             'address_line', o.address_line, 'area', o.area, 'city', o.city,
             'subtotal', o.subtotal, 'discount', o.discount, 'shipping_cost', o.shipping_cost,
             'sa_cost_total', o.sa_cost_total, 'packaging_total', o.packaging_total,
             'delivery_cost', o.delivery_cost, 'received_amount', o.received_amount,
             'advance_amount', o.advance_amount, 'advance_by', o.advance_by, 'payment_provider', o.payment_provider, 'transaction_id', o.transaction_id, 'payment_sender', o.payment_sender, 'payment_config_id', o.payment_config_id, 'paid_amount', o.paid_amount, 'total', o.total,
             'status', o.status, 'payment_status', o.payment_status, 'payment_method', o.payment_method,
             'forwarded_to_admin', o.forwarded_to_admin, 'created_at', o.created_at,
             'updated_at', o.updated_at, 'reseller_note', o.reseller_note, 'admin_note', o.admin_note,
             'resellers', case when r.id is null then null else jsonb_build_object(
               'business_name', r.business_name, 'code', r.code, 'contact_phone', r.contact_phone,
               'agents', case when a.id is null then null else jsonb_build_object('display_name', a.display_name) end
             ) end
           ) as row
    from orders o
    left join resellers r on r.id = o.reseller_id
    left join agents a on a.id = r.agent_id
    where (_statuses is null or array_length(_statuses, 1) is null or o.status::text = any(_statuses))
      and (v_from is null or o.created_at >= v_from)
      and (v_to is null or o.created_at <= v_to)
    order by o.created_at desc
    limit _limit
  ) s;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (select order_id, product_id, product_name, product_image, quantity, returned_qty,
               reseller_price, line_total, sa_price, buying_price, packaging_cost
        from order_items where order_id = any(v_ids)) i;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_ship
  from (select id, order_id, provider, tracking_id, consignment_id from shipments where order_id = any(v_ids)) s;

  if _limit is null then
    select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) into v_counts
    from (select status::text as status, count(*) as c from orders
          where (v_from is null or created_at >= v_from) and (v_to is null or created_at <= v_to)
          group by 1) t;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name, 'code', code, 'contact_phone', contact_phone) order by business_name), '[]'::jsonb)
    into v_resellers from resellers;

  return jsonb_build_object('orders', v_orders, 'items', v_items, 'shipments', v_ship,
                            'status_counts', coalesce(v_counts, '{}'::jsonb), 'resellers', v_resellers,
                            'partial', _limit is not null);
end;
$function$;

DROP FUNCTION IF EXISTS public.reseller_orders_page();
CREATE FUNCTION public.reseller_orders_page(_limit integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_rid uuid; v_orders jsonb; v_ids uuid[]; v_items jsonb; v_ship jsonb; v_events jsonb;
  v_listings jsonb := '[]'::jsonb; v_products jsonb := '[]'::jsonb;
begin
  v_rid := public.current_reseller_id();
  if v_rid is null then
    return jsonb_build_object('reseller_id', null);
  end if;

  select coalesce(jsonb_agg(to_jsonb(o) order by o.created_at desc), '[]'::jsonb), coalesce(array_agg(o.id), '{}'::uuid[])
    into v_orders, v_ids
  from (
    select id, order_number, customer_name, customer_phone, address_line, city, area, subtotal,
           shipping_cost, discount, total, sa_cost_total, reseller_profit, received_amount,
           packaging_total, delivery_cost, advance_amount, advance_by, payment_method, payment_provider, transaction_id, payment_sender, payment_config_id, paid_amount, status,
           payment_status, forwarded_to_admin, notes, reseller_note, created_at, updated_at
    from orders where reseller_id = v_rid
    order by created_at desc
    limit _limit
  ) o;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (select order_id, product_id, product_name, product_image, quantity, returned_qty,
               reseller_price, line_total, sa_price
        from order_items where order_id = any(v_ids)) i;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_ship
  from (select id, order_id, provider, tracking_id, consignment_id, status, courier_status, last_event_at
        from shipments where order_id = any(v_ids)) s;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events
  from (select order_id, provider, courier_status, note, event_at
        from courier_events where order_id = any(v_ids)) e;

  if _limit is null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'selling_price', l.selling_price,
        'products', jsonb_build_object(
          'id', p.id, 'brand_id', p.brand_id, 'category_id', p.category_id, 'name', p.name,
          'product_code', p.product_code, 'reseller_price', p.reseller_price,
          'packaging_cost', p.packaging_cost, 'stock', p.stock, 'delivery_inside', p.delivery_inside,
          'delivery_outside', p.delivery_outside, 'delivery_sub', p.delivery_sub, 'delivery_mode', p.delivery_mode,
          'delivery_flat', p.delivery_flat, 'og_image_url', p.og_image_url))), '[]'::jsonb)
      into v_listings
    from reseller_listings l join products p on p.id = l.product_id
    where l.reseller_id = v_rid and l.is_active;

    select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_products
    from (select id, brand_id, category_id, name, slug, product_code, reseller_price, packaging_cost,
                 stock, delivery_inside, delivery_outside, delivery_sub, delivery_mode, delivery_flat,
                 og_image_url, suggested_price
          from products where is_active order by created_at desc) p;
  end if;

  return jsonb_build_object('reseller_id', v_rid, 'orders', v_orders, 'items', v_items,
                            'shipments', v_ship, 'events', v_events, 'listings', v_listings,
                            'products', v_products, 'partial', _limit is not null);
end;
$function$;

DROP FUNCTION IF EXISTS public.admin_resellers_bootstrap();
CREATE FUNCTION public.admin_resellers_bootstrap(_limit integer DEFAULT NULL, _status text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY[
    'staff.manage','resellers.manage','resellers.view','resellers.view_all',
    'resellers.edit','resellers.verify','resellers.password','resellers.impersonate'
  ]);

  WITH rr AS (
    SELECT * FROM public.resellers r
    WHERE _status IS NULL OR r.status::text = _status
    ORDER BY r.created_at DESC
    LIMIT _limit
  ), o AS (
    SELECT o.reseller_id, COUNT(*)::bigint AS orders,
           COALESCE(SUM(CASE WHEN o.status IN ('delivered','returned','cancelled') THEN o.reseller_profit ELSE 0 END), 0) AS delivered_profit
    FROM public.orders o WHERE o.reseller_id IN (SELECT id FROM rr) GROUP BY o.reseller_id
  ), p AS (
    SELECT py.reseller_id,
           COALESCE(SUM(CASE WHEN py.status IN ('pending','approved') THEN py.amount ELSE 0 END), 0) AS pending_payout,
           COALESCE(SUM(CASE WHEN py.status = 'paid' THEN py.amount ELSE 0 END), 0) AS paid_out
    FROM public.payouts py WHERE py.reseller_id IN (SELECT id FROM rr) GROUP BY py.reseller_id
  ), d AS (
    SELECT rd.reseller_id, COALESCE(SUM(rd.amount),0) AS deposit_balance
    FROM public.reseller_deposits rd WHERE rd.reseller_id IN (SELECT id FROM rr) GROUP BY rd.reseller_id
  ), rws AS (
    SELECT jsonb_build_object(
      'id', r.id, 'user_id', r.user_id, 'avatar_url', r.avatar_url,
      'business_name', r.business_name, 'code', r.code,
      'contact_phone', r.contact_phone, 'address', r.address, 'nid_number', r.nid_number,
      'status', r.status, 'commission_rate', r.commission_rate,
      'leader_id', r.leader_id, 'agent_id', r.agent_id,
      'notes', r.notes, 'notes_by', r.notes_by, 'notes_at', r.notes_at,
      'approved_at', r.approved_at, 'created_at', r.created_at,
      'payout_method', r.payout_method, 'payout_account_name', r.payout_account_name,
      'payout_account_number', r.payout_account_number, 'payout_bank_name', r.payout_bank_name,
      'payout_branch', r.payout_branch, 'payout_routing', r.payout_routing,
      'deposit_required', r.deposit_required, 'deposit_required_amount', r.deposit_required_amount,
      'frozen_amount', r.frozen_amount,
      'subscription_plan', r.subscription_plan,
      'subscription_expires_at', r.subscription_expires_at,
      'subscription_trial_ends_at', r.subscription_trial_ends_at,
      'subscription_exempt', r.subscription_exempt,
      'subscription_enrolled', r.subscription_enrolled,
      'subscription_enrolled_at', r.subscription_enrolled_at,
      'email', u.email::text,
      'email_confirmed', (u.email_confirmed_at IS NOT NULL),
      'email_verified', (pr.email_verified_at IS NOT NULL),
      'phone_verified', (pr.phone_verified_at IS NOT NULL),
      'notes_author', na.full_name,
      'orders', COALESCE(o.orders, 0),
      'delivered_profit', COALESCE(o.delivered_profit, 0),
      'pending_payout', COALESCE(p.pending_payout, 0),
      'paid_out', COALESCE(p.paid_out, 0),
      'available', GREATEST(COALESCE(o.delivered_profit,0)+COALESCE(d.deposit_balance,0)-COALESCE(p.pending_payout,0)-COALESCE(p.paid_out,0)-COALESCE(r.frozen_amount,0),0),
      'deposit_balance', COALESCE(d.deposit_balance, 0)
    ) AS j, r.created_at AS ca
    FROM rr r
    LEFT JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.profiles pr ON pr.id = r.user_id
    LEFT JOIN public.profiles na ON na.id = r.notes_by
    LEFT JOIN o ON o.reseller_id = r.id
    LEFT JOIN p ON p.reseller_id = r.id
    LEFT JOIN d ON d.reseller_id = r.id
  )
  SELECT jsonb_build_object(
    'resellers', COALESCE((SELECT jsonb_agg(j ORDER BY ca DESC) FROM rws), '[]'::jsonb),
    'agents', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'display_name', a.display_name, 'user_id', a.user_id) ORDER BY a.display_name) FROM public.agents a), '[]'::jsonb),
    'partial', _limit IS NOT NULL
  ) INTO v;
  RETURN v;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_orders_page(text[], bigint, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_orders_page(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resellers_bootstrap(integer, text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_resellers_created ON public.resellers (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resellers_status_created ON public.resellers (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipments (order_id);
