CREATE OR REPLACE FUNCTION public.create_public_order(
  _reseller_code text,
  _customer_name text,
  _customer_phone text,
  _customer_email text,
  _address_line text,
  _city text,
  _area delivery_area,
  _landmark text,
  _payment_method payment_method,
  _notes text,
  _items jsonb,
  _payment_config_id uuid DEFAULT NULL,
  _txn_id text DEFAULT NULL,
  _sender text DEFAULT NULL
)
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
  v_item_ship NUMERIC(12,2);
  v_profit NUMERIC(12,2) := 0;
  v_item JSONB;
  v_listing RECORD;
  v_qty INT;
  v_line NUMERIC(12,2);
  v_sa_line NUMERIC(12,2);
  v_wholesale NUMERIC(12,2);
  v_pc public.payment_configs%ROWTYPE;
  v_method payment_method := _payment_method;
  v_payment_config_id UUID := NULL;
  v_payment_provider TEXT := NULL;
  v_transaction_id TEXT := NULL;
  v_payment_sender TEXT := NULL;
  v_advance_by TEXT := NULL;
BEGIN
  IF _customer_name IS NULL OR length(trim(_customer_name)) < 2 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _customer_phone IS NULL OR length(trim(_customer_phone)) < 6 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF _address_line IS NULL OR length(trim(_address_line)) < 3 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  SELECT r.* INTO v_reseller FROM public.resellers r WHERE r.code = _reseller_code AND r.status = 'active' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Store not found'; END IF;

  IF _payment_config_id IS NOT NULL THEN
    SELECT pc.* INTO v_pc FROM public.payment_configs pc
     WHERE pc.id = _payment_config_id AND pc.is_active AND pc.mode = 'manual'
       AND (pc.reseller_id IS NULL OR pc.reseller_id = v_reseller.id);
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment method unavailable'; END IF;
    IF _txn_id IS NULL OR length(trim(_txn_id)) < 4 THEN RAISE EXCEPTION 'Transaction ID required'; END IF;
    v_method := v_pc.method;
    v_payment_config_id := v_pc.id;
    v_payment_provider := 'manual:' || v_pc.label;
    v_transaction_id := trim(_txn_id);
    v_payment_sender := nullif(trim(coalesce(_sender,'')), '');
    v_advance_by := CASE WHEN v_pc.reseller_id IS NULL THEN 'admin' ELSE 'reseller' END;
  END IF;

  INSERT INTO public.orders AS o (
    reseller_id, customer_name, customer_phone, customer_email, address_line, city, area, landmark,
    payment_method, notes, status, payment_config_id, payment_provider, transaction_id, payment_sender, advance_by
  ) VALUES (
    v_reseller.id, trim(_customer_name), trim(_customer_phone), _customer_email, trim(_address_line),
    _city, _area, _landmark, v_method, _notes, 'pending',
    v_payment_config_id,
    v_payment_provider,
    v_transaction_id,
    v_payment_sender,
    v_advance_by
  ) RETURNING o.id, o.order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'quantity')::int, 1));
    SELECT l.*, p.name AS product_name, COALESCE(rp.reseller_price, p.reseller_price) AS reseller_price,
           COALESCE(rp.packaging_cost, p.packaging_cost) AS packaging_cost,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_inside,0) ELSE p.delivery_inside END AS delivery_inside,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_outside,0) ELSE p.delivery_outside END AS delivery_outside,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_sub, rp.delivery_outside, 0) ELSE p.delivery_sub END AS delivery_sub,
           COALESCE(rp.delivery_mode, p.delivery_mode) AS delivery_mode,
           CASE WHEN rp.delivery_mode IS NOT NULL THEN COALESCE(rp.delivery_flat,0) ELSE p.delivery_flat END AS delivery_flat,
           p.og_image_url
      INTO v_listing
      FROM public.reseller_listings l JOIN public.products p ON p.id = l.product_id
      LEFT JOIN public.reseller_product_prices rp ON rp.product_id = p.id AND rp.reseller_id = v_reseller.id
      WHERE l.id = (v_item->>'listing_id')::uuid AND l.reseller_id = v_reseller.id AND l.is_active = true AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
    v_wholesale := COALESCE((SELECT rp.reseller_price FROM public.reseller_product_prices rp
        WHERE rp.reseller_id = v_reseller.id AND rp.product_id = v_listing.product_id), v_listing.reseller_price);
    v_line := v_listing.selling_price * v_qty;
    v_sa_line := (v_wholesale + v_listing.packaging_cost) * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_sa_cost := v_sa_cost + v_sa_line;
    v_item_ship := public.resolve_delivery_charge_for(
      v_listing.product_id, v_listing.delivery_mode, v_listing.delivery_flat, v_listing.delivery_inside,
      v_listing.delivery_outside, v_listing.delivery_sub, _area::text);
    IF v_item_ship > 0 THEN
      v_item_ship := v_item_ship + CASE WHEN _area = 'inside_dhaka'
        THEN COALESCE(v_listing.extra_delivery_inside, 0) ELSE COALESCE(v_listing.extra_delivery_outside, 0) END;
    END IF;
    IF v_item_ship > v_ship THEN v_ship := v_item_ship; END IF;
    INSERT INTO public.order_items(order_id, listing_id, product_id, product_name, product_image, sku, quantity,
      sa_price, reseller_price, profit, line_total)
    VALUES (v_order_id, v_listing.id, v_listing.product_id, v_listing.product_name, v_listing.og_image_url, NULL, v_qty,
      v_wholesale + v_listing.packaging_cost, v_listing.selling_price, v_line - v_sa_line, v_line);
  END LOOP;

  v_profit := v_subtotal - v_sa_cost;
  UPDATE public.orders o SET subtotal = v_subtotal, shipping_cost = v_ship, total = v_subtotal + v_ship,
         sa_cost_total = v_sa_cost, reseller_profit = v_profit WHERE o.id = v_order_id;
  RETURN QUERY SELECT v_order_id, v_order_number;
END
$function$;

REVOKE ALL ON FUNCTION public.create_public_order(text,text,text,text,text,text,delivery_area,text,payment_method,text,jsonb,uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(text,text,text,text,text,text,delivery_area,text,payment_method,text,jsonb,uuid,text,text) TO anon, authenticated, service_role;
