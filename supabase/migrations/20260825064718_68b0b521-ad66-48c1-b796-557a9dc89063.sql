-- Custom delivery rules: product / brand / category targeted rules stored in
-- global_settings.advanced_settings->'delivery'->'rules'.
CREATE OR REPLACE FUNCTION public.delivery_rule_charge(_product_id uuid, _area text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rules jsonb;
  rule jsonb;
  p RECORD;
  m text;
BEGIN
  IF _product_id IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(advanced_settings->'delivery'->'rules', '[]'::jsonb) INTO rules
    FROM public.global_settings WHERE id = 1;
  IF rules IS NULL OR jsonb_typeof(rules) <> 'array' OR jsonb_array_length(rules) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id, brand_id, category_id INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  FOR rule IN SELECT * FROM jsonb_array_elements(rules) LOOP
    IF COALESCE((rule->>'enabled')::boolean, true) THEN
      IF (rule->'target'->'products') ? p.id::text
         OR (p.brand_id IS NOT NULL AND (rule->'target'->'brands') ? p.brand_id::text)
         OR (p.category_id IS NOT NULL AND (rule->'target'->'categories') ? p.category_id::text)
      THEN
        m := COALESCE(rule->>'mode', 'flat');
        IF m = 'free' THEN RETURN 0; END IF;
        IF m IN ('flat', 'custom') THEN RETURN COALESCE((rule->>m)::numeric, 0); END IF;
        RETURN COALESCE((rule->'areas'->>COALESCE(_area, 'outside_dhaka'))::numeric, 0);
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END
$$;

GRANT EXECUTE ON FUNCTION public.delivery_rule_charge(uuid, text) TO anon, authenticated, service_role;

-- Product override -> custom rule -> global rule.
CREATE OR REPLACE FUNCTION public.resolve_delivery_charge_for(
  _product_id uuid, _mode text, _flat numeric, _inside numeric, _outside numeric, _sub numeric, _area text
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v numeric;
BEGIN
  IF COALESCE(_mode, 'global') = 'global' THEN
    v := public.delivery_rule_charge(_product_id, _area);
    IF v IS NOT NULL THEN RETURN v; END IF;
  END IF;
  RETURN public.resolve_delivery_charge(_mode, _flat, _inside, _outside, _sub, _area);
END
$$;

GRANT EXECUTE ON FUNCTION public.resolve_delivery_charge_for(uuid, text, numeric, numeric, numeric, numeric, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_delivery_charge(_product_id uuid, _area text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT delivery_mode, delivery_flat, delivery_inside, delivery_outside, delivery_sub
    INTO p FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  RETURN public.resolve_delivery_charge_for(
    _product_id, p.delivery_mode, p.delivery_flat, p.delivery_inside, p.delivery_outside, p.delivery_sub, _area);
END
$$;

-- Storefront checkout: highest single-product delivery charge wins.
CREATE OR REPLACE FUNCTION public.create_public_order(
  _reseller_code text, _customer_name text, _customer_phone text, _customer_email text,
  _address_line text, _city text, _area delivery_area, _landmark text,
  _payment_method payment_method, _notes text, _items jsonb
) RETURNS TABLE(order_id uuid, order_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reseller RECORD;
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal NUMERIC(12,2) := 0;
  v_sa_cost NUMERIC(12,2) := 0;
  v_ship NUMERIC(12,2) := 0;
  v_item_ship NUMERIC(12,2);
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

  INSERT INTO public.orders AS o (
    reseller_id, customer_name, customer_phone, customer_email, address_line, city, area, landmark,
    payment_method, notes, status
  ) VALUES (
    v_reseller.id, trim(_customer_name), trim(_customer_phone), _customer_email, trim(_address_line),
    _city, _area, _landmark, _payment_method, _notes, 'pending'
  ) RETURNING o.id, o.order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT l.*, p.name AS product_name, p.reseller_price, p.packaging_cost,
           p.delivery_inside, p.delivery_outside, p.delivery_sub, p.delivery_mode, p.delivery_flat, p.og_image_url
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

    v_item_ship := public.resolve_delivery_charge_for(
      v_listing.product_id, v_listing.delivery_mode, v_listing.delivery_flat, v_listing.delivery_inside,
      v_listing.delivery_outside, v_listing.delivery_sub, _area::text);

    IF v_item_ship > 0 THEN
      v_item_ship := v_item_ship + CASE WHEN _area = 'inside_dhaka'
        THEN COALESCE(v_listing.extra_delivery_inside, 0)
        ELSE COALESCE(v_listing.extra_delivery_outside, 0) END;
    END IF;

    IF v_item_ship > v_ship THEN v_ship := v_item_ship; END IF;

    INSERT INTO public.order_items(
      order_id, listing_id, product_id, product_name, product_image, sku, quantity,
      sa_price, reseller_price, profit, line_total
    ) VALUES (
      v_order_id, v_listing.id, v_listing.product_id, v_listing.product_name, v_listing.og_image_url, NULL, v_qty,
      v_listing.reseller_price + v_listing.packaging_cost, v_listing.selling_price,
      v_line - v_sa_line, v_line
    );
  END LOOP;

  v_profit := v_subtotal - v_sa_cost;

  UPDATE public.orders o
     SET subtotal = v_subtotal,
         shipping_cost = v_ship,
         total = v_subtotal + v_ship,
         sa_cost_total = v_sa_cost,
         reseller_profit = v_profit
   WHERE o.id = v_order_id;

  RETURN QUERY SELECT v_order_id, v_order_number;
END
$$;
