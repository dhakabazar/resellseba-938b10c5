-- admin_lookups: include stock + delivery_sub for products
CREATE OR REPLACE FUNCTION public.admin_lookups()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.has_any_permission(auth.uid(), '{orders.view,orders.create,orders.edit,products.view,products.manage,resellers.manage}'::text[]) then
    raise exception 'not authorized';
  end if;

  return jsonb_build_object(
    'resellers', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name, 'code', code, 'contact_phone', contact_phone) order by business_name), '[]'::jsonb)
      from resellers
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'slug', slug, 'product_code', product_code, 'og_image_url', og_image_url,
        'brand_id', brand_id, 'category_id', category_id, 'buying_price', buying_price,
        'suggested_price', suggested_price, 'reseller_price', reseller_price, 'packaging_cost', packaging_cost,
        'stock', stock,
        'delivery_mode', delivery_mode, 'delivery_flat', delivery_flat, 'delivery_inside', delivery_inside,
        'delivery_outside', delivery_outside, 'delivery_sub', delivery_sub)), '[]'::jsonb)
      from products where is_active
    )
  );
end;
$function$;

-- reseller_orders_page: include stock in listings + products
CREATE OR REPLACE FUNCTION public.reseller_orders_page()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rid uuid;
  v_orders jsonb;
  v_ids uuid[];
  v_items jsonb;
  v_ship jsonb;
  v_events jsonb;
  v_listings jsonb;
  v_products jsonb;
begin
  v_rid := public.current_reseller_id();
  if v_rid is null then
    return jsonb_build_object('reseller_id', null);
  end if;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb), coalesce(array_agg(o.id), '{}'::uuid[])
    into v_orders, v_ids
  from (
    select id, order_number, customer_name, customer_phone, address_line, city, area, subtotal,
           shipping_cost, discount, total, sa_cost_total, reseller_profit, received_amount,
           packaging_total, delivery_cost, advance_amount, advance_by, payment_method, status,
           payment_status, forwarded_to_admin, notes, reseller_note, created_at, updated_at
    from orders
    where reseller_id = v_rid
    order by created_at desc
    limit 5000
  ) o;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (
    select order_id, product_id, product_name, product_image, quantity, returned_qty,
           reseller_price, line_total, sa_price
    from order_items where order_id = any(v_ids)
  ) i;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_ship
  from (
    select id, order_id, provider, tracking_id, consignment_id, status, courier_status, last_event_at
    from shipments where order_id = any(v_ids)
  ) s;

  select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) into v_events
  from (
    select order_id, provider, courier_status, note, event_at
    from courier_events where order_id = any(v_ids)
  ) e;

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
  from (
    select id, brand_id, category_id, name, slug, product_code, reseller_price, packaging_cost,
           stock, delivery_inside, delivery_outside, delivery_sub, delivery_mode, delivery_flat,
           og_image_url, suggested_price
    from products where is_active order by created_at desc
  ) p;

  return jsonb_build_object('reseller_id', v_rid, 'orders', v_orders, 'items', v_items,
                            'shipments', v_ship, 'events', v_events, 'listings', v_listings,
                            'products', v_products);
end;
$function$;

-- reseller_dashboard: include stock in listings + products
CREATE OR REPLACE FUNCTION public.reseller_dashboard(_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rid uuid;
  v_reseller jsonb;
  v_orders jsonb;
  v_items jsonb;
  v_payouts jsonb;
  v_comm jsonb;
  v_summary jsonb;
  v_listings jsonb;
  v_products jsonb;
  v_total int;
  v_active int;
begin
  v_rid := public.current_reseller_id();
  if v_rid is null then
    return jsonb_build_object('reseller', null);
  end if;

  select to_jsonb(r) into v_reseller from resellers r where r.id = v_rid;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into v_orders
  from (
    select id, order_number, reseller_id, status, created_at, subtotal, shipping_cost, discount,
           total, sa_cost_total, reseller_profit, received_amount, packaging_total, delivery_cost,
           advance_amount, advance_by
    from orders
    where reseller_id = v_rid
      and (_from is null or created_at >= _from)
      and (_to is null or created_at <= _to)
    order by created_at desc
    limit 5000
  ) o;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (
    select oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.sa_price,
           oi.reseller_price, oi.line_total, oi.profit
    from order_items oi
    join orders o on o.id = oi.order_id
    where o.reseller_id = v_rid
      and (_from is null or o.created_at >= _from)
      and (_to is null or o.created_at <= _to)
  ) i;

  select coalesce(jsonb_agg(jsonb_build_object('amount', p.amount, 'status', p.status, 'created_at', p.created_at)), '[]'::jsonb)
    into v_payouts from payouts p where p.reseller_id = v_rid;

  select coalesce(jsonb_agg(jsonb_build_object('amount', c.amount, 'status', c.status, 'created_at', c.created_at)), '[]'::jsonb)
    into v_comm from leader_commissions c where c.leader_id = v_rid;

  select to_jsonb(s) into v_summary from public.reseller_profit_summary(v_rid) s limit 1;

  select count(*), count(*) filter (where is_active) into v_total, v_active
  from reseller_listings where reseller_id = v_rid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id,
      'selling_price', l.selling_price,
      'products', jsonb_build_object(
        'id', p.id, 'brand_id', p.brand_id, 'category_id', p.category_id, 'name', p.name,
        'product_code', p.product_code, 'reseller_price', p.reseller_price,
        'packaging_cost', p.packaging_cost, 'stock', p.stock, 'delivery_inside', p.delivery_inside,
        'delivery_outside', p.delivery_outside, 'delivery_sub', p.delivery_sub, 'delivery_mode', p.delivery_mode,
        'delivery_flat', p.delivery_flat, 'og_image_url', p.og_image_url)
    )), '[]'::jsonb)
    into v_listings
  from reseller_listings l
  join products p on p.id = l.product_id
  where l.reseller_id = v_rid and l.is_active;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_products
  from (
    select id, brand_id, category_id, name, slug, product_code, reseller_price, packaging_cost,
           stock, delivery_inside, delivery_outside, delivery_sub, delivery_mode, delivery_flat,
           og_image_url, suggested_price, created_at
    from products where is_active
    order by created_at desc
  ) p;

  return jsonb_build_object(
    'reseller', v_reseller,
    'orders', v_orders,
    'items', v_items,
    'payouts', v_payouts,
    'commissions', v_comm,
    'summary', v_summary,
    'listings', v_listings,
    'listings_total', v_total,
    'listings_active', v_active,
    'products', v_products
  );
end;
$function$;