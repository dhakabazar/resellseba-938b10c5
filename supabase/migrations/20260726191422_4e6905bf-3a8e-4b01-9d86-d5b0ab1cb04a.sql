
-- 1) Add reseller_price and backfill from existing buying_price (old semantics)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reseller_price numeric(12,2) NOT NULL DEFAULT 0;
UPDATE public.products SET reseller_price = buying_price WHERE reseller_price = 0;

-- 2) Drop min_selling_price
ALTER TABLE public.products DROP COLUMN IF EXISTS min_selling_price;

-- 3) Rebuild create_public_order to use reseller_price as the reseller's cost basis
CREATE OR REPLACE FUNCTION public.create_public_order(
  _reseller_code text, _customer_name text, _customer_phone text, _customer_email text,
  _address_line text, _city text, _area delivery_area, _landmark text,
  _payment_method payment_method, _notes text, _items jsonb)
RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_reseller RECORD;
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal NUMERIC(12,2) := 0;
  v_sa_cost NUMERIC(12,2) := 0;
  v_ship NUMERIC(12,2) := 0;
  v_profit NUMERIC(12,2) := 0;
  v_item JSONB;
  v_listing RECORD;
  v_qty INT;
  v_line NUMERIC(12,2);
  v_sa_line NUMERIC(12,2);
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _customer_phone IS NULL OR length(trim(_customer_phone)) < 6 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF _address_line IS NULL OR length(trim(_address_line)) < 3 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  SELECT r.* INTO v_reseller FROM public.resellers r WHERE r.code = _reseller_code AND r.status = 'active' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

  INSERT INTO public.orders (
    reseller_id, customer_name, customer_phone, customer_email, address_line, city, area, landmark,
    payment_method, notes, status
  ) VALUES (
    v_reseller.id, trim(_customer_name), trim(_customer_phone), _customer_email, trim(_address_line),
    _city, _area, _landmark, _payment_method, _notes, 'pending'
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT l.*, p.name AS product_name, p.reseller_price, p.packaging_cost,
           p.delivery_inside, p.delivery_outside, p.og_image_url
      INTO v_listing
      FROM public.reseller_listings l
      JOIN public.products p ON p.id = l.product_id
      WHERE l.id = (v_item->>'listing_id')::uuid
        AND l.reseller_id = v_reseller.id
        AND l.is_active = true
        AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable'; END IF;

    v_line := v_listing.selling_price * v_qty;
    v_sa_line := (v_listing.reseller_price + v_listing.packaging_cost) * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_sa_cost := v_sa_cost + v_sa_line;

    IF v_ship = 0 THEN
      IF _area = 'inside_dhaka' THEN
        v_ship := v_listing.delivery_inside + COALESCE(v_listing.extra_delivery_inside,0);
      ELSE
        v_ship := v_listing.delivery_outside + COALESCE(v_listing.extra_delivery_outside,0);
      END IF;
    END IF;

    INSERT INTO public.order_items(
      order_id, listing_id, product_id, product_name, product_image, sku, quantity,
      sa_price, reseller_price, profit, line_total
    ) VALUES (
      v_order_id, v_listing.id, v_listing.product_id, v_listing.product_name, v_listing.og_image_url, NULL, v_qty,
      v_listing.reseller_price + v_listing.packaging_cost,
      v_listing.selling_price,
      (v_listing.selling_price - v_listing.reseller_price - v_listing.packaging_cost) * v_qty,
      v_line
    );
  END LOOP;

  v_profit := (v_subtotal - v_sa_cost);
  UPDATE public.orders SET
    subtotal = v_subtotal,
    shipping_cost = v_ship,
    total = v_subtotal + v_ship,
    sa_cost_total = v_sa_cost,
    reseller_profit = v_profit
  WHERE id = v_order_id;

  RETURN QUERY SELECT v_order_id, v_order_number;
END;
$function$;
