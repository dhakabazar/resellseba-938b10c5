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
  v_pixels jsonb;
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

  -- marketing pixels: reseller-owned first, platform-wide as fallback
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_pixels from (
    select platform, pixel_id, (reseller_id is null) as is_global
    from public_marketing_pixels
    where reseller_id = v_rid or reseller_id is null
  ) t;

  return jsonb_build_object(
    'store', v_store,
    'listings', v_listings,
    'categories', v_cats,
    'menu', v_menu,
    'delivery', v_delivery,
    'pixels', v_pixels
  );
end;
$$;

revoke all on function public.store_bootstrap(text) from public;
grant execute on function public.store_bootstrap(text) to anon, authenticated, service_role;