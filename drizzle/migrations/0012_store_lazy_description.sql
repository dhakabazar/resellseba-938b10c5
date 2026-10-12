CREATE OR REPLACE FUNCTION public.store_product_description(_product_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select p.description from products p where p.id = _product_id and p.is_active
$$;
GRANT EXECUTE ON FUNCTION public.store_product_description(uuid) TO anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_listings_reseller_active_created ON public.reseller_listings (reseller_id, created_at DESC) WHERE is_active;
DO $do$
DECLARE src text;
BEGIN
  SELECT pg_get_functiondef('public.store_bootstrap(text)'::regprocedure) INTO src;
  IF position($x$'description', p.description,$x$ in src) = 0 THEN RAISE EXCEPTION 'pattern not found'; END IF;
  src := replace(src, $x$'description', p.description,$x$, $x$'has_description', (p.description is not null and p.description <> ''),$x$);
  EXECUTE src;
END $do$;