
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS product_code text;

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_tries int := 0;
BEGIN
  LOOP
    v_code := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM public.products WHERE product_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_tries := v_tries + 1;
    IF v_tries > 50 THEN RAISE EXCEPTION 'Could not generate unique product code'; END IF;
  END LOOP;
  RETURN v_code;
END $$;

-- Backfill
UPDATE public.products SET product_code = public.generate_product_code() WHERE product_code IS NULL;

-- Enforce
ALTER TABLE public.products ALTER COLUMN product_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_product_code_key ON public.products(product_code);

-- Auto-assign trigger
CREATE OR REPLACE FUNCTION public.set_product_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.product_code IS NULL OR NEW.product_code = '' THEN
    NEW.product_code := public.generate_product_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_product_code ON public.products;
CREATE TRIGGER trg_set_product_code
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_code();
