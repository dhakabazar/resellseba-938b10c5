DROP FUNCTION IF EXISTS public.admin_orders_page(text[]);

CREATE OR REPLACE FUNCTION public.admin_orders_page(_statuses text[] DEFAULT NULL::text[], _from_ts bigint DEFAULT NULL::bigint, _to_ts bigint DEFAULT NULL::bigint)
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
    where (_statuses is null or array_length(_statuses, 1) is null or o.status::text = any(_statuses))
      and (_from_ts is null or (extract(epoch from o.created_at) * 1000)::bigint >= _from_ts)
      and (_to_ts is null or (extract(epoch from o.created_at) * 1000)::bigint <= _to_ts)
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
  from (
    select status::text as status, count(*) as c from orders
    where (_from_ts is null or (extract(epoch from created_at) * 1000)::bigint >= _from_ts)
      and (_to_ts is null or (extract(epoch from created_at) * 1000)::bigint <= _to_ts)
    group by 1
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name, 'code', code, 'contact_phone', contact_phone) order by business_name), '[]'::jsonb)
    into v_resellers from resellers;

  return jsonb_build_object('orders', v_orders, 'items', v_items, 'shipments', v_ship,
                            'status_counts', v_counts, 'resellers', v_resellers);
end;
$function$;