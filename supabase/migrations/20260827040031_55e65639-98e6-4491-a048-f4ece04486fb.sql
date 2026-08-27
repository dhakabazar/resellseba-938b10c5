-- ── Landing page: one call ────────────────────────────────────────────────
create or replace function public.lp_bootstrap(_host text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
  v_store jsonb;
  v_cats jsonb;
  v_prods jsonb := '[]'::jsonb;
  v_p int; v_c int; v_s int;
begin
  select to_jsonb(g) into v_settings from (
    select site_name, tagline, logo_url, favicon_url, og_image_url, landing_content,
           primary_color, accent_color, contact_email, contact_phone,
           meta_description, meta_title_template
    from global_settings where id = 1
  ) g;

  if _host is not null and _host <> '' then
    select jsonb_build_object('code', r.code, 'status', r.status::text)
      into v_store
    from reseller_domains d
    join resellers r on r.id = d.reseller_id
    where lower(d.hostname) = lower(_host) and d.verified_at is not null
    limit 1;
  end if;

  select count(*) into v_p from products where is_active;
  select count(*) into v_c from categories where is_active;
  select count(*) into v_s from orders where status in ('delivered','partial');

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_cats from (
    select c.id, c.name, c.slug, c.image_url, count(p.id)::int as product_count
    from categories c
    join products p on p.category_id = c.id and p.is_active
    where c.is_active
    group by c.id, c.name, c.slug, c.image_url, c.sort_order
    order by c.sort_order, c.name
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_prods from (
    select p.id, p.name, p.slug,
      (select i.url from product_images i where i.product_id = p.id
        order by i.is_primary desc nulls last, i.sort_order limit 1) as main_image,
      p.suggested_price as price, p.reseller_price as base_price,
      coalesce(p.short_description,'') as description
    from products p
    where p.is_active and p.is_featured
    order by p.created_at desc
    limit 6
  ) t;

  if v_prods = '[]'::jsonb then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_prods from (
      select p.id, p.name, p.slug,
        (select i.url from product_images i where i.product_id = p.id
          order by i.is_primary desc nulls last, i.sort_order limit 1) as main_image,
        p.suggested_price as price, p.reseller_price as base_price,
        coalesce(p.short_description,'') as description
      from products p
      join (select product_id, sum(quantity) q from order_items
            where product_id is not null group by product_id) s on s.product_id = p.id
      where p.is_active
      order by s.q desc
      limit 6
    ) t;
  end if;

  if v_prods = '[]'::jsonb then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_prods from (
      select p.id, p.name, p.slug,
        (select i.url from product_images i where i.product_id = p.id
          order by i.is_primary desc nulls last, i.sort_order limit 1) as main_image,
        p.suggested_price as price, p.reseller_price as base_price,
        coalesce(p.short_description,'') as description
      from products p
      where p.is_active
      order by p.created_at desc
      limit 6
    ) t;
  end if;

  return jsonb_build_object(
    'settings', coalesce(v_settings,'{}'::jsonb),
    'store', v_store,
    'stats', jsonb_build_object('totalProducts', v_p, 'totalCategories', v_c, 'totalSales', v_s),
    'categories', v_cats,
    'products', v_prods
  );
end;
$$;

revoke all on function public.lp_bootstrap(text) from public;
grant execute on function public.lp_bootstrap(text) to anon, authenticated, service_role;

-- ── Storefront: one call ──────────────────────────────────────────────────
create or replace function public.store_bootstrap(_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store jsonb;
  v_rid uuid;
  v_listings jsonb;
  v_cats jsonb;
  v_menu jsonb;
  v_delivery jsonb;
begin
  select to_jsonb(s), s.reseller_id into v_store, v_rid
  from public_stores s
  where s.code = _code;

  if v_rid is null then
    return jsonb_build_object('store', null);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_listings from (
    select l.id, l.selling_price, l.custom_title, l.custom_description,
      l.extra_delivery_inside, l.extra_delivery_outside, l.created_at,
      jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug,
        'product_code', p.product_code,
        'short_description', p.short_description,
        'description', p.description,
        'stock', p.stock,
        'category_id', p.category_id, 'brand_id', p.brand_id,
        'is_featured', p.is_featured,
        'delivery_mode', p.delivery_mode, 'delivery_flat', p.delivery_flat,
        'delivery_inside', p.delivery_inside, 'delivery_outside', p.delivery_outside,
        'delivery_sub', p.delivery_sub,
        'product_images', coalesce((
          select jsonb_agg(jsonb_build_object('url', i.url, 'is_primary', i.is_primary, 'sort_order', i.sort_order)
                           order by i.sort_order, i.is_primary desc nulls last)
          from product_images i where i.product_id = p.id), '[]'::jsonb)
      ) as product
    from reseller_listings l
    join products p on p.id = l.product_id and p.is_active
    where l.reseller_id = v_rid and l.is_active
    order by l.created_at desc
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_cats from (
    select distinct c.id, c.name, c.slug, c.image_url, c.sort_order
    from categories c
    join products p on p.category_id = c.id and p.is_active
    join reseller_listings l on l.product_id = p.id and l.reseller_id = v_rid and l.is_active
    where c.is_active
    order by c.sort_order, c.name
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_menu from (
    select m.id, m.parent_id, m.label, m.kind, m.ref_slug, m.url, m.image_url,
           m.description, m.open_new_tab, m.layout, m.sort_order
    from reseller_menu_items m
    where m.reseller_id = v_rid and m.is_active
    order by m.sort_order, m.label
  ) t;

  select coalesce(advanced_settings->'delivery', '{}'::jsonb) into v_delivery
  from global_settings where id = 1;

  return jsonb_build_object(
    'store', v_store,
    'listings', v_listings,
    'categories', v_cats,
    'menu', v_menu,
    'delivery', v_delivery
  );
end;
$$;

revoke all on function public.store_bootstrap(text) from public;
grant execute on function public.store_bootstrap(text) to anon, authenticated, service_role;