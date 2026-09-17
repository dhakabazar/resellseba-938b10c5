CREATE OR REPLACE FUNCTION public.store_bootstrap(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_store jsonb;
  v_rid uuid;
  v_listings jsonb;
  v_cats jsonb;
  v_menu jsonb;
  v_settings jsonb;
  v_pixels jsonb;
  v_pay jsonb;
begin
  select to_jsonb(s), s.reseller_id into v_store, v_rid
  from public_stores s
  where s.code = _code;

  if v_rid is null then
    return jsonb_build_object('store', null);
  end if;

  if not public.subscription_store_allowed(v_rid) then
    return jsonb_build_object('store', null, 'store_closed', true);
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
        'category_ids', coalesce((select jsonb_agg(pc.category_id) from product_categories pc where pc.product_id = p.id), '[]'::jsonb),
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
    select c.id, c.name, c.slug, c.image_url, c.sort_order,
           count(distinct p.id)::int as product_count
    from categories c
    join product_categories pc on pc.category_id = c.id
    join products p on p.id = pc.product_id and p.is_active
    join reseller_listings l on l.product_id = p.id and l.reseller_id = v_rid and l.is_active
    where c.is_active
    group by c.id, c.name, c.slug, c.image_url, c.sort_order
    order by c.sort_order, c.name
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_menu from (
    select m.id, m.parent_id, m.label, m.kind, m.ref_slug, m.url, m.image_url,
           m.description, m.open_new_tab, m.layout, m.sort_order
    from reseller_menu_items m
    where m.reseller_id = v_rid and m.is_active
    order by m.sort_order, m.label
  ) t;

  select jsonb_build_object(
           'id', g.id,
           'site_name', g.site_name,
           'logo_url', g.logo_url,
           'favicon_url', g.favicon_url,
           'primary_color', g.primary_color,
           'accent_color', g.accent_color,
           'contact_email', g.contact_email,
           'contact_phone', g.contact_phone,
           'label_size', g.label_size,
           'privacy_policy', g.privacy_policy,
           'advanced_settings', g.advanced_settings
         )
    into v_settings
  from global_settings g where g.id = 1;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_pixels from (
    select platform, pixel_id, (reseller_id is null) as is_global
    from public_marketing_pixels
    where reseller_id = v_rid or reseller_id is null
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_pay from (
    select pc.method, pc.label, pc.instructions, pc.reseller_id
    from payment_configs pc
    where pc.is_active
      and pc.mode = 'manual'
      and (
        pc.reseller_id = v_rid
        or (
          pc.reseller_id is null
          and not exists (
            select 1 from payment_configs x
            where x.reseller_id = v_rid and x.method = pc.method
          )
        )
      )
  ) t;

  return jsonb_build_object(
    'store', v_store,
    'store_closed', false,
    'listings', v_listings,
    'categories', v_cats,
    'menu', v_menu,
    'settings', v_settings,
    'delivery', coalesce(v_settings->'advanced_settings'->'delivery', '{}'::jsonb),
    'pixels', v_pixels,
    'payment_methods', v_pay
  );
end;
$function$;
