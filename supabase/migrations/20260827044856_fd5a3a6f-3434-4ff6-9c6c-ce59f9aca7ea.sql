create or replace function public.reseller_catalog_page()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (select id from resellers where user_id = auth.uid() limit 1)
  select jsonb_build_object(
    'reseller_id', (select id from me),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'product_code', p.product_code,
        'reseller_price', p.reseller_price, 'packaging_cost', p.packaging_cost,
        'delivery_inside', p.delivery_inside, 'delivery_outside', p.delivery_outside,
        'delivery_sub', p.delivery_sub, 'delivery_mode', p.delivery_mode,
        'delivery_flat', p.delivery_flat, 'suggested_price', p.suggested_price,
        'stock', p.stock, 'og_image_url', p.og_image_url,
        'brand_id', p.brand_id, 'category_id', p.category_id
      ) order by p.created_at desc), '[]'::jsonb)
      from products p where p.is_active
    ),
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb)
      from brands b where b.is_active
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb)
      from categories c where c.is_active
    ),
    'listed_product_ids', (
      select coalesce(jsonb_agg(l.product_id), '[]'::jsonb)
      from reseller_listings l where l.reseller_id = (select id from me)
    )
  );
$$;

revoke execute on function public.reseller_catalog_page() from public, anon;
grant execute on function public.reseller_catalog_page() to authenticated;