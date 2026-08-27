create or replace function public.reseller_dashboard(_from timestamptz default null, _to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
        'packaging_cost', p.packaging_cost, 'delivery_inside', p.delivery_inside,
        'delivery_outside', p.delivery_outside, 'delivery_mode', p.delivery_mode,
        'delivery_flat', p.delivery_flat, 'og_image_url', p.og_image_url)
    )), '[]'::jsonb)
    into v_listings
  from reseller_listings l
  join products p on p.id = l.product_id
  where l.reseller_id = v_rid and l.is_active;

  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into v_products
  from (
    select id, brand_id, category_id, name, slug, product_code, reseller_price, packaging_cost,
           delivery_inside, delivery_outside, delivery_mode, delivery_flat, og_image_url,
           suggested_price, created_at
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
$$;

grant execute on function public.reseller_dashboard(timestamptz, timestamptz) to authenticated;

create or replace function public.admin_dashboard(_from timestamptz default null, _to timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_range jsonb;
  v_all jsonb;
  v_pay jsonb;
  v_catalog jsonb;
  v_resellers jsonb;
  v_metrics jsonb;
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'staff')) then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) into v_range
  from (
    select o.total, o.shipping_cost, o.reseller_profit, o.sa_cost_total, o.received_amount,
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
$$;

grant execute on function public.admin_dashboard(timestamptz, timestamptz) to authenticated;

create or replace function public.admin_lookups()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'staff')) then
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
        'suggested_price', suggested_price, 'reseller_price', reseller_price, 'packaging_cost', packaging_cost,
        'delivery_mode', delivery_mode, 'delivery_flat', delivery_flat, 'delivery_inside', delivery_inside,
        'delivery_outside', delivery_outside)), '[]'::jsonb)
      from products where is_active
    )
  );
end;
$$;

grant execute on function public.admin_lookups() to authenticated;