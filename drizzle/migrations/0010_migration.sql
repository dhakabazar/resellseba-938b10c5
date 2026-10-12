
DROP FUNCTION IF EXISTS public.admin_catalog_page();
CREATE FUNCTION public.admin_catalog_page(_limit integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if not public.has_any_permission(auth.uid(), '{products.view,products.manage,brands.manage,categories.manage}'::text[]) then
    raise exception 'not authorized';
  end if;
  return jsonb_build_object(
    'products', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb)
      from (
        select pr.id, pr.product_code, pr.name, pr.buying_price, pr.reseller_price, pr.suggested_price, pr.stock,
               pr.is_active, pr.is_featured, pr.og_image_url, pr.brand_id, pr.category_id, pr.created_at,
               coalesce((select jsonb_agg(pc.category_id) from product_categories pc where pc.product_id = pr.id), '[]'::jsonb) as category_ids
        from products pr order by pr.created_at desc limit _limit
      ) p
    ),
    'brands', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) from brands),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'product_count',
               case when _limit is null then (select count(distinct pc.product_id) from product_categories pc join products p2 on p2.id = pc.product_id where pc.category_id = c.id) else null end
             ) order by c.name), '[]'::jsonb) from categories c
    ),
    'partial', _limit is not null
  );
end;
$function$;

DROP FUNCTION IF EXISTS public.reseller_catalog_page();
CREATE FUNCTION public.reseller_catalog_page(_limit integer DEFAULT NULL)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  with me as (select id from resellers where user_id = auth.uid() limit 1),
  pp as (select * from products p where p.is_active order by p.created_at desc limit _limit)
  select jsonb_build_object(
    'reseller_id', (select id from me),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'product_code', p.product_code,
        'reseller_price', coalesce(rp.reseller_price, p.reseller_price),
        'base_reseller_price', p.reseller_price,
        'has_custom_price', (rp.reseller_price is not null),
        'packaging_cost', p.packaging_cost,
        'delivery_inside', p.delivery_inside, 'delivery_outside', p.delivery_outside,
        'delivery_sub', p.delivery_sub, 'delivery_mode', p.delivery_mode,
        'delivery_flat', p.delivery_flat, 'suggested_price', p.suggested_price,
        'stock', p.stock, 'og_image_url', p.og_image_url,
        'brand_id', p.brand_id, 'category_id', p.category_id,
        'category_ids', coalesce((select jsonb_agg(pc.category_id) from product_categories pc where pc.product_id = p.id), '[]'::jsonb)
      ) order by p.created_at desc), '[]'::jsonb)
      from pp p
      left join reseller_product_prices rp on rp.product_id = p.id and rp.reseller_id = (select id from me)
    ),
    'brands', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb) from brands b where b.is_active),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'product_count',
               case when _limit is null then (select count(distinct pc.product_id) from product_categories pc join products p2 on p2.id = pc.product_id and p2.is_active where pc.category_id = c.id) else null end
             ) order by c.name), '[]'::jsonb)
      from categories c where c.is_active
    ),
    'listed_product_ids', (select coalesce(jsonb_agg(l.product_id), '[]'::jsonb) from reseller_listings l where l.reseller_id = (select id from me)),
    'partial', _limit is not null
  );
$function$;

GRANT EXECUTE ON FUNCTION public.admin_catalog_page(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_catalog_page(integer) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_products_created ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_active_created ON public.products (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_reseller_created ON public.reseller_listings (reseller_id, created_at DESC);
