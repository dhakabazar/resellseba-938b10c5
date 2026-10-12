ALTER TABLE public.reseller_listings ADD COLUMN IF NOT EXISTS compare_at_price numeric DEFAULT NULL;
COMMENT ON COLUMN public.reseller_listings.compare_at_price IS 'Optional regular price for storefront discount display only; selling_price remains the actual payable price.';
ALTER TABLE public.reseller_listings ADD CONSTRAINT reseller_listings_compare_at_price_valid CHECK (compare_at_price IS NULL OR (compare_at_price > selling_price AND compare_at_price > 0));
DO $migration$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.store_bootstrap(text)'::regprocedure);
  IF position('l.id, l.selling_price, l.custom_title' in definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected store_bootstrap listing projection';
  END IF;
  definition := replace(definition, 'l.id, l.selling_price, l.custom_title', 'l.id, l.selling_price, l.compare_at_price, l.custom_title');
  EXECUTE definition;
END;
$migration$;