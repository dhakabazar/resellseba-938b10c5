CREATE OR REPLACE FUNCTION public.lp_bootstrap(_host text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_settings jsonb;
  v_store jsonb;
  v_cats jsonb;
  v_prods jsonb := '[]'::jsonb;
  v_p int; v_c int; v_s int;
begin
  select to_jsonb(g) into v_settings from (
    select site_name, tagline, logo_url, favicon_url, og_image_url, landing_content,
           primary_color, accent_color, secondary_color, highlight_color,
           contact_email, contact_phone,
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
$function$;