-- Reseller orders: no row cap
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

-- Admin orders: no row cap
CREATE OR REPLACE FUNCTION public.admin_orders_page(_statuses text[] DEFAULT NULL::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_orders jsonb;
  v_ids uuid[];
  v_items jsonb;
  v_ship jsonb;
  v_counts jsonb;
  v_resellers jsonb;
begin
  if not public.has_any_permission(auth.uid(), '{orders.view,orders.edit,orders.create,orders.delete,orders.status,orders.ship}'::text[]) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(row order by (row->>'created_at') desc), '[]'::jsonb), coalesce(array_agg(id), '{}'::uuid[])
    into v_orders, v_ids
  from (
    select o.id,
           jsonb_build_object(
             'id', o.id, 'reseller_id', o.reseller_id, 'order_number', o.order_number,
             'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
             'address_line', o.address_line, 'area', o.area, 'city', o.city,
             'subtotal', o.subtotal, 'discount', o.discount, 'shipping_cost', o.shipping_cost,
             'sa_cost_total', o.sa_cost_total, 'packaging_total', o.packaging_total,
             'delivery_cost', o.delivery_cost, 'received_amount', o.received_amount,
             'advance_amount', o.advance_amount, 'advance_by', o.advance_by, 'total', o.total,
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
    where _statuses is null or array_length(_statuses, 1) is null or o.status::text = any(_statuses)
    order by o.created_at desc
  ) s;

  select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) into v_items
  from (
    select order_id, product_id, product_name, product_image, quantity, returned_qty,
           reseller_price, line_total, sa_price, buying_price, packaging_cost
    from order_items where order_id = any(v_ids)
  ) i;

  select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) into v_ship
  from (
    select id, order_id, provider, tracking_id, consignment_id
    from shipments where order_id = any(v_ids)
  ) s;

  select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) into v_counts
  from (select status::text as status, count(*) as c from orders group by 1) t;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name, 'code', code, 'contact_phone', contact_phone) order by business_name), '[]'::jsonb)
    into v_resellers from resellers;

  return jsonb_build_object('orders', v_orders, 'items', v_items, 'shipments', v_ship,
                            'status_counts', v_counts, 'resellers', v_resellers);
end;
$function$;

-- Indexes: cover the list filters/sorts, drop a duplicate
DROP INDEX IF EXISTS public.idx_orders_reseller;
CREATE INDEX IF NOT EXISTS idx_orders_reseller_status_created ON public.orders (reseller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_reseller_updated ON public.orders (reseller_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_reseller_profit_status ON public.orders (reseller_id, status, updated_at DESC) INCLUDE (reseller_profit);
CREATE INDEX IF NOT EXISTS idx_courier_events_order_only ON public.courier_events (order_id);
ANALYZE public.orders;
ANALYZE public.order_items;
ANALYZE public.shipments;
ANALYZE public.courier_events;