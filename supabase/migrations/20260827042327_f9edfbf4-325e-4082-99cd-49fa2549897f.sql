create or replace function public.admin_lookups()
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
    'resellers', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'business_name', business_name, 'code', code, 'contact_phone', contact_phone) order by business_name), '[]'::jsonb)
      from resellers
    ),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'slug', slug, 'product_code', product_code, 'og_image_url', og_image_url,
        'brand_id', brand_id, 'category_id', category_id, 'buying_price', buying_price,
        'suggested_price', suggested_price, 'reseller_price', reseller_price, 'packaging_cost', packaging_cost,
        'delivery_mode', delivery_mode, 'delivery_flat', delivery_flat, 'delivery_inside', delivery_inside,
        'delivery_outside', delivery_outside)), '[]'::jsonb)
      from products where is_active
    )
  );
end;
$$;

revoke execute on function public.admin_lookups() from public, anon;
grant execute on function public.admin_lookups() to authenticated;