-- Migration: Fix lp_bootstrap custom domain store resolution
-- Ensures custom domain visitors (both root and www) are accurately mapped to their reseller store,
-- even if verified_at is null but SSL/ownership is active.

CREATE OR REPLACE FUNCTION public.lp_bootstrap(_host text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_settings jsonb;
  v_store jsonb;
  v_cats jsonb;
  v_prods jsonb := '[]'::jsonb;
  v_p int; v_c int; v_s int;
  v_clean_host text;
  v_base_host text;
begin
  select to_jsonb(g) into v_settings from (
    select site_name, tagline, logo_url, favicon_url, og_image_url, landing_content,
           primary_color, accent_color, secondary_color, highlight_color,
           contact_email, contact_phone,
           meta_description, meta_title_template
    from global_settings where id = 1
  ) g;

  if _host is not null and _host <> '' then
    v_clean_host := lower(trim(_host));
    v_base_host := regexp_replace(v_clean_host, '^www\.', '');

    select jsonb_build_object('code', r.code, 'status', r.status::text)
      into v_store
    from reseller_domains d
    join resellers r on r.id = d.reseller_id
    where (
      lower(d.hostname) = v_clean_host
      or lower(d.hostname) = v_base_host
      or lower(d.hostname) = 'www.' || v_base_host
    )
    and (
      d.verified_at is not null
      or d.ssl_status = 'active'
      or d.ownership_status = 'active'
    )
    order by (d.verified_at is not null) desc, d.created_at desc
    limit 1;
  end if;

  select count(*) into v_p from products where is_active;
  select count(*) into v_c from categories where is_active;
  select count(*) into v_s from orders where status in ('delivered','partial');

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_cats from (
    select c.id, c.name, c.slug, c.image_url, count(distinct pc.product_id)::int as product_count
    from categories c
    join product_categories pc on pc.category_id = c.id
    join products p on p.id = pc.product_id and p.is_active
    where c.is_active
    group by c.id, c.name, c.slug, c.image_url, c.sort_order
    order by c.sort_order, c.name
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_prods from (
    select p.id, p.name, p.slug,
      (select i.url from product_images i where i.product_id = p.id
        order by i.is_primary desc nulls last, i.sort_order limit 1) as main_image,
      p.suggested_price as price, p.reseller_price as base_price,
      coalesce(p.short_description,'') as description,
      p.category_id,
      coalesce((select jsonb_agg(pc.category_id) from product_categories pc where pc.product_id = p.id), '[]'::jsonb) as category_ids
    from products p
    where p.is_active
    order by p.is_featured desc nulls last, p.created_at desc
    limit 20
  ) t;

  return jsonb_build_object(
    'settings', coalesce(v_settings,'{}'::jsonb),
    'store', v_store,
    'stats', jsonb_build_object('totalProducts', v_p, 'totalCategories', v_c, 'totalSales', v_s),
    'categories', v_cats,
    'products', v_prods
  );
end;
$$;

GRANT EXECUTE ON FUNCTION public.lp_bootstrap(text) TO anon, authenticated;
