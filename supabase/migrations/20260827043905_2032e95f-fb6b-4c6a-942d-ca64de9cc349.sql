create or replace function public.admin_catalog_page()
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
    'products', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]'::jsonb)
      from (
        select id, product_code, name, buying_price, reseller_price, suggested_price, stock,
               is_active, is_featured, og_image_url, brand_id, category_id, created_at
        from products
      ) p
    ),
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) from brands
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name), '[]'::jsonb) from categories
    )
  );
end;
$$;

revoke execute on function public.admin_catalog_page() from public, anon;
grant execute on function public.admin_catalog_page() to authenticated;