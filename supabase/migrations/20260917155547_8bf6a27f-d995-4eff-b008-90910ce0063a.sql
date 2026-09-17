CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, category_id)
);

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PC: anon read" ON public.product_categories FOR SELECT TO anon USING (true);
CREATE POLICY "PC: auth read" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "PC: admin manage" ON public.product_categories FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "PC: staff manage by permission" ON public.product_categories FOR ALL TO authenticated
  USING (public.has_any_permission(auth.uid(), ARRAY['products.manage','products.create','products.edit']))
  WITH CHECK (public.has_any_permission(auth.uid(), ARRAY['products.manage','products.create','products.edit']));

CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_product ON public.product_categories(product_id);

INSERT INTO public.product_categories (product_id, category_id)
SELECT p.id, p.category_id FROM public.products p
WHERE p.category_id IS NOT NULL
ON CONFLICT (product_id, category_id) DO NOTHING;

-- Keep the single-category column in sync for older code paths (importer, scraper).
CREATE OR REPLACE FUNCTION public.product_category_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if NEW.category_id is not null then
    insert into product_categories (product_id, category_id)
    values (NEW.id, NEW.category_id)
    on conflict (product_id, category_id) do nothing;
  end if;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_product_category_sync ON public.products;
CREATE TRIGGER trg_product_category_sync
AFTER INSERT OR UPDATE OF category_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.product_category_sync();

CREATE OR REPLACE FUNCTION public.product_categories_primary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  update products set category_id = NEW.category_id
  where id = NEW.product_id and category_id is null;
  return NEW;
end;
$$;

DROP TRIGGER IF EXISTS trg_product_categories_primary ON public.product_categories;
CREATE TRIGGER trg_product_categories_primary
AFTER INSERT ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.product_categories_primary();

-- Landing page bootstrap: counts + per-product category ids across all links.
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

-- Admin catalog page: expose all category ids per product.
CREATE OR REPLACE FUNCTION public.admin_catalog_page()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        from products pr
      ) p
    ),
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) from brands
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'product_count',
               (select count(distinct pc.product_id) from product_categories pc join products p2 on p2.id = pc.product_id where pc.category_id = c.id)
             ) order by c.name), '[]'::jsonb) from categories c
    )
  );
end;
$$;

-- Reseller catalog page: all category ids + counts.
CREATE OR REPLACE FUNCTION public.reseller_catalog_page()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  with me as (select id from resellers where user_id = auth.uid() limit 1)
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
      from products p
      left join reseller_product_prices rp
        on rp.product_id = p.id and rp.reseller_id = (select id from me)
      where p.is_active
    ),
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb)
      from brands b where b.is_active
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'product_count',
               (select count(distinct pc.product_id) from product_categories pc join products p2 on p2.id = pc.product_id and p2.is_active where pc.category_id = c.id)
             ) order by c.name), '[]'::jsonb)
      from categories c where c.is_active
    ),
    'listed_product_ids', (
      select coalesce(jsonb_agg(l.product_id), '[]'::jsonb)
      from reseller_listings l where l.reseller_id = (select id from me)
    )
  );
$$;
