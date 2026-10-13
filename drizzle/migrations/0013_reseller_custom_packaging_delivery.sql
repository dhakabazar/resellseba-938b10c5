ALTER TABLE public.reseller_product_prices
  ADD COLUMN IF NOT EXISTS packaging_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_mode text,
  ADD COLUMN IF NOT EXISTS delivery_flat numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_inside numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_outside numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_sub numeric(12,2);
ALTER TABLE public.reseller_product_prices ADD CONSTRAINT rpp_delivery_mode_chk
  CHECK (delivery_mode IS NULL OR delivery_mode IN ('area','flat','free','custom'));
CREATE INDEX IF NOT EXISTS idx_rpp_reseller_product ON public.reseller_product_prices (reseller_id, product_id);

DO $mig$
DECLARE d text; n text;
BEGIN
  -- create_public_order: resolve reseller overrides for price, packaging, delivery
  d := pg_get_functiondef('public.create_public_order(text,text,text,text,text,text,delivery_area,text,payment_method,text,jsonb,uuid,text,text)'::regprocedure);
  n := replace(d, 'SELECT l.*, p.name AS product_name, p.reseller_price, p.packaging_cost,
           p.delivery_inside, p.delivery_outside, p.delivery_sub, p.delivery_mode, p.delivery_flat, p.og_image_url
      INTO v_listing
      FROM public.reseller_listings l JOIN public.products p ON p.id = l.product_id',
  'SELECT l.*, p.name AS product_name, COALESCE(rp.reseller_price, p.reseller_price) AS reseller_price,
           COALESCE(rp.packaging_cost, p.packaging_cost) AS packaging_cost,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_inside,0) ELSE p.delivery_inside END AS delivery_inside,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_outside,0) ELSE p.delivery_outside END AS delivery_outside,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_sub, rp.delivery_outside, 0) ELSE p.delivery_sub END AS delivery_sub,
           COALESCE(rp.delivery_mode, p.delivery_mode) AS delivery_mode,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_flat,0) ELSE p.delivery_flat END AS delivery_flat,
           p.og_image_url
      INTO v_listing
      FROM public.reseller_listings l JOIN public.products p ON p.id = l.product_id
      LEFT JOIN public.reseller_product_prices rp ON rp.product_id = p.id AND rp.reseller_id = v_reseller.id');
  IF n = d THEN RAISE EXCEPTION 'create_public_order patch did not match'; END IF;
  EXECUTE n;

  -- store_bootstrap: storefront shows reseller delivery override
  d := pg_get_functiondef('public.store_bootstrap(text)'::regprocedure);
  n := replace(d, '''delivery_mode'', p.delivery_mode, ''delivery_flat'', p.delivery_flat,
        ''delivery_inside'', p.delivery_inside, ''delivery_outside'', p.delivery_outside,
        ''delivery_sub'', p.delivery_sub,',
  '''delivery_mode'', coalesce(rp.delivery_mode, p.delivery_mode),
        ''delivery_flat'', case when rp.delivery_mode is not null then coalesce(rp.delivery_flat,0) else p.delivery_flat end,
        ''delivery_inside'', case when rp.delivery_mode is not null then coalesce(rp.delivery_inside,0) else p.delivery_inside end,
        ''delivery_outside'', case when rp.delivery_mode is not null then coalesce(rp.delivery_outside,0) else p.delivery_outside end,
        ''delivery_sub'', case when rp.delivery_mode is not null then coalesce(rp.delivery_sub, rp.delivery_outside, 0) else p.delivery_sub end,');
  n := replace(n, 'join products p on p.id = l.product_id and p.is_active
    where l.reseller_id = v_rid and l.is_active',
  'join products p on p.id = l.product_id and p.is_active
    left join reseller_product_prices rp on rp.product_id = p.id and rp.reseller_id = v_rid
    where l.reseller_id = v_rid and l.is_active');
  IF n = d OR position('left join reseller_product_prices' in n) = 0 THEN RAISE EXCEPTION 'store_bootstrap patch did not match'; END IF;
  EXECUTE n;

  -- reseller_catalog_page: reseller sees own packaging/delivery
  d := pg_get_functiondef('public.reseller_catalog_page(integer)'::regprocedure);
  n := replace(d, '''packaging_cost'', p.packaging_cost,
        ''delivery_inside'', p.delivery_inside, ''delivery_outside'', p.delivery_outside,
        ''delivery_sub'', p.delivery_sub, ''delivery_mode'', p.delivery_mode,
        ''delivery_flat'', p.delivery_flat,',
  '''packaging_cost'', coalesce(rp.packaging_cost, p.packaging_cost),
        ''base_packaging_cost'', p.packaging_cost,
        ''has_custom_packaging'', (rp.packaging_cost is not null),
        ''has_custom_delivery'', (rp.delivery_mode is not null),
        ''delivery_inside'', case when rp.delivery_mode is not null then coalesce(rp.delivery_inside,0) else p.delivery_inside end,
        ''delivery_outside'', case when rp.delivery_mode is not null then coalesce(rp.delivery_outside,0) else p.delivery_outside end,
        ''delivery_sub'', case when rp.delivery_mode is not null then coalesce(rp.delivery_sub, rp.delivery_outside, 0) else p.delivery_sub end,
        ''delivery_mode'', coalesce(rp.delivery_mode, p.delivery_mode),
        ''delivery_flat'', case when rp.delivery_mode is not null then coalesce(rp.delivery_flat,0) else p.delivery_flat end,');
  IF n = d THEN RAISE EXCEPTION 'reseller_catalog_page patch did not match'; END IF;
  EXECUTE n;
END $mig$;

CREATE OR REPLACE FUNCTION public.snapshot_order_item_costs()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_buy numeric(12,2); v_pack numeric(12,2); v_custom numeric(12,2);
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    SELECT COALESCE(buying_price, 0), COALESCE(packaging_cost, 0) INTO v_buy, v_pack
    FROM public.products WHERE id = NEW.product_id;
    SELECT rp.packaging_cost INTO v_custom FROM public.orders o
      JOIN public.reseller_product_prices rp ON rp.reseller_id = o.reseller_id AND rp.product_id = NEW.product_id
     WHERE o.id = NEW.order_id;
    IF v_custom IS NOT NULL THEN v_pack := v_custom; END IF;
    IF COALESCE(NEW.buying_price, 0) = 0 THEN NEW.buying_price := COALESCE(v_buy, 0); END IF;
    IF COALESCE(NEW.packaging_cost, 0) = 0 THEN NEW.packaging_cost := COALESCE(v_pack, 0); END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.reseller_custom_rate_summary()
 RETURNS TABLE(reseller_id uuid, products integer, last_updated timestamptz)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  select rp.reseller_id, count(*)::int, max(rp.updated_at)
  from public.reseller_product_prices rp group by rp.reseller_id
$$;
GRANT EXECUTE ON FUNCTION public.reseller_custom_rate_summary() TO authenticated;