CREATE OR REPLACE FUNCTION public.reseller_menu_page(_rid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
SELECT jsonb_build_object(
 'menu', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from reseller_menu_items m where m.reseller_id = _rid), '[]'::jsonb),
 'categories', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from (select id,name,slug,image_url,sort_order from categories where is_active) c), '[]'::jsonb),
 'listings', coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'custom_title',l.custom_title,'product',jsonb_build_object('name',p.name,'slug',p.slug,'is_active',p.is_active))) from reseller_listings l join products p on p.id=l.product_id where l.reseller_id=_rid and l.is_active and p.is_active), '[]'::jsonb),
 'body_items', (select theme_settings->'__body_categories'->>'items' from reseller_settings where reseller_id=_rid)
) WHERE _rid=public.current_reseller_id() OR public.is_super_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.reseller_menu_page(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reseller_menu_page(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_store_body_categories(_rid uuid, _items jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF _rid IS DISTINCT FROM public.current_reseller_id() AND NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid category list'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(_items) e WHERE jsonb_typeof(e->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(e->'is_active') IS DISTINCT FROM 'boolean') THEN RAISE EXCEPTION 'Invalid category item'; END IF;
 UPDATE public.reseller_settings SET theme_settings=jsonb_set(coalesce(theme_settings,'{}'::jsonb),'{__body_categories}',jsonb_build_object('items',_items::text),true) WHERE reseller_id=_rid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Store settings not found'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.save_store_body_categories(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_store_body_categories(uuid,jsonb) TO authenticated, service_role;