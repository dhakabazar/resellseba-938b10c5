CREATE OR REPLACE FUNCTION public.admin_dashboard(_from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_range jsonb;
  v_all jsonb;
  v_pay jsonb;
  v_catalog jsonb;
  v_resellers jsonb;
  v_metrics jsonb;
begin
  if not public.has_any_permission(auth.uid(), '{dashboard.view,finance.view,reports.view}'::text[]) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into v_range
  from (
    select o.id, o.order_number, o.reseller_id, o.subtotal, o.discount,
           o.total, o.shipping_cost, o.reseller_profit, o.sa_cost_total, o.received_amount,
           o.packaging_total, o.delivery_cost, o.advance_amount, o.advance_by, o.created_at, o.status,
           case when r.id is null then null else jsonb_build_object('business_name', r.business_name) end as resellers
    from orders o
    left join resellers r on r.id = o.reseller_id
    where (_from is null or o.created_at >= _from)
      and (_to is null or o.created_at <= _to)
    order by o.created_at desc
    limit 5000
  ) o;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into v_all
  from (
    select id, order_number, reseller_id, status, created_at, subtotal, shipping_cost, discount,
           total, sa_cost_total, reseller_profit, received_amount, packaging_total, delivery_cost,
           advance_amount, advance_by
    from orders
    order by created_at desc
    limit 20000
  ) o;

  select jsonb_build_object(
    'paid', coalesce(sum(amount) filter (where status = 'paid'), 0),
    'due', coalesce(sum(amount) filter (where status in ('pending','approved')), 0)
  ) into v_pay from payouts;

  select jsonb_build_object(
    'products', (select count(*) from products),
    'active', (select count(*) from products where is_active),
    'inactive', (select count(*) from products where not is_active),
    'featured', (select count(*) from products where is_featured),
    'low', (select count(*) from products where stock > 0 and stock <= 5),
    'out', (select count(*) from products where stock <= 0),
    'categories', (select count(*) from categories),
    'activeCategories', (select count(*) from categories where is_active),
    'brands', (select count(*) from brands),
    'activeBrands', (select count(*) from brands where is_active)
  ) into v_catalog;

  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where status = 'active'),
    'pending', count(*) filter (where status = 'pending'),
    'suspended', count(*) filter (where status = 'suspended'),
    'rejected', count(*) filter (where status = 'rejected')
  ) into v_resellers from resellers;

  select jsonb_build_object(
    'withStore', count(*) filter (where coalesce(m.orders, 0) > 0),
    'depositBalance', coalesce(sum(m.deposit_balance), 0),
    'frozen', coalesce(sum(m.frozen_amount), 0),
    'withdrawable', coalesce(sum(m.available), 0)
  ) into v_metrics from public.admin_reseller_metrics() m;

  return jsonb_build_object(
    'range_orders', v_range,
    'all_orders', v_all,
    'payouts', v_pay,
    'catalog', v_catalog,
    'resellers', v_resellers,
    'metrics', v_metrics
  );
end;
$function$;