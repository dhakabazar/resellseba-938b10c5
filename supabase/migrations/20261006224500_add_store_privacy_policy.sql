-- Add privacy_policy column to global_settings and store_settings if not exists
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS privacy_policy TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS privacy_policy TEXT;

-- Update store_bootstrap to include custom store privacy policy or fallback to global
CREATE OR REPLACE FUNCTION public.store_bootstrap(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_rid uuid;
  v_store jsonb;
  v_closed boolean := false;
  v_list jsonb;
  v_cats jsonb;
  v_menu jsonb;
  v_deliv jsonb;
  v_settings jsonb;
  v_pixels jsonb;
  v_pay jsonb;
begin
  select r.id into v_rid from resellers r where lower(r.code) = lower(trim(_code)) limit 1;
  if v_rid is null then
    select d.reseller_id into v_rid from reseller_domains d where lower(d.hostname) = lower(trim(_code)) limit 1;
  end if;

  if v_rid is null then
    return null;
  end if;

  if not public.reseller_has_active_package(v_rid) then
    return jsonb_build_object('store', null, 'store_closed', true);
  end if;

  select to_jsonb(t) into v_store from (
    select s.*, r.business_name, r.code as reseller_code, r.phone as reseller_phone
    from store_settings s
    join resellers r on r.id = s.reseller_id
    where s.reseller_id = v_rid
    limit 1
  ) t;

  if v_store is null then
    return null;
  end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_list from (
    select l.id, l.reseller_id, l.product_id, l.selling_price, l.custom_title,
           l.extra_delivery_inside, l.extra_delivery_outside, l.created_at,
           jsonb_build_object(
             'id', p.id,
             'name', p.name,
             'slug', p.slug,
             'product_code', p.product_code,
             'stock', p.stock,
             'category_id', p.category_id,
             'brand_id', p.brand_id,
             'short_description', p.short_description,
             'description', p.description,
             'delivery_mode', p.delivery_mode,
             'custom_delivery_charge_inside', p.custom_delivery_charge_inside,
             'custom_delivery_charge_outside', p.custom_delivery_charge_outside,
             'product_images', (
               select coalesce(jsonb_agg(jsonb_build_object(
                 'url', pi.url,
                 'is_primary', pi.is_primary,
                 'sort_order', pi.sort_order
               ) order by pi.sort_order, pi.created_at), '[]'::jsonb)
               from product_images pi
               where pi.product_id = p.id
             )
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
    order by pc.reseller_id nulls last
  ) t;

  select jsonb_build_object(
           'inside_dhaka', coalesce((g.advanced_settings->'delivery_rules'->>'inside_dhaka')::numeric, 70),
           'outside_dhaka', coalesce((g.advanced_settings->'delivery_rules'->>'outside_dhaka')::numeric, 130),
           'express', coalesce((g.advanced_settings->'delivery_rules'->>'express')::numeric, 150)
         )
    into v_deliv
  from global_settings g where g.id = 1;

  return jsonb_build_object(
    'store', v_store,
    'listings', v_list,
    'categories', v_cats,
    'menu', v_menu,
    'settings', v_settings,
    'delivery', v_deliv,
    'pixels', v_pixels,
    'payment_methods', v_pay
  );
end;
$$;

GRANT EXECUTE ON FUNCTION public.store_bootstrap(text) TO anon, authenticated, service_role;
