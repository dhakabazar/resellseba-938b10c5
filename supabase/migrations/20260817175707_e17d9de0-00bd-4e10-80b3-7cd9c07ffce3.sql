CREATE OR REPLACE FUNCTION public.seed_reseller_store(_reseller_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing int;
  v_ins int := 0;
  v_hero text;
  v_name text;
BEGIN
  SELECT count(*) INTO v_existing FROM public.reseller_listings WHERE reseller_id = _reseller_id;
  IF v_existing > 0 THEN RETURN 0; END IF;

  WITH sold AS (
    SELECT oi.product_id, SUM(oi.quantity)::numeric AS qty
    FROM public.order_items oi
    WHERE oi.product_id IS NOT NULL
    GROUP BY 1
  ), ranked AS (
    SELECT p.id, p.suggested_price, p.reseller_price, p.created_at,
           COALESCE(s.qty, 0) AS qty,
           ROW_NUMBER() OVER (
             PARTITION BY p.category_id
             ORDER BY COALESCE(s.qty, 0) DESC, p.created_at DESC
           ) AS rn_cat
    FROM public.products p
    LEFT JOIN sold s ON s.product_id = p.id
    WHERE p.is_active = true
  ), picked AS (
    SELECT id, suggested_price, reseller_price
    FROM ranked
    ORDER BY rn_cat ASC, qty DESC, created_at DESC
    LIMIT 20
  )
  INSERT INTO public.reseller_listings (reseller_id, product_id, selling_price, is_active)
  SELECT _reseller_id, id,
         GREATEST(COALESCE(NULLIF(suggested_price, 0), ROUND(reseller_price * 1.2)), reseller_price),
         true
  FROM picked
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_ins = ROW_COUNT;

  SELECT og_image_url INTO v_hero FROM public.global_settings ORDER BY id LIMIT 1;
  SELECT COALESCE(NULLIF(business_name, ''), 'My Store') INTO v_name FROM public.resellers WHERE id = _reseller_id;

  INSERT INTO public.reseller_settings (reseller_id, store_name, hero_image_url)
  VALUES (_reseller_id, COALESCE(v_name, 'My Store'), v_hero)
  ON CONFLICT (reseller_id) DO UPDATE
    SET hero_image_url = COALESCE(public.reseller_settings.hero_image_url, v_hero);

  RETURN v_ins;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_reseller_store(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seed_reseller_store_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.seed_reseller_store(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_reseller_store ON public.resellers;
CREATE TRIGGER trg_seed_reseller_store
AFTER INSERT ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.seed_reseller_store_on_create();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.resellers LOOP
    PERFORM public.seed_reseller_store(r.id);
  END LOOP;
END $$;