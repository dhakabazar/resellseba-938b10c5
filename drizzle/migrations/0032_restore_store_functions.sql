CREATE OR REPLACE FUNCTION public.store_bootstrap(_code text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_store jsonb; v_rid uuid; v_listings jsonb; v_cats jsonb; v_menu jsonb; v_settings jsonb; v_pixels jsonb; v_pay jsonb;
begin
  _code := public.resolve_store_code(_code);
  select to_jsonb(s), s.reseller_id into v_store, v_rid from public_stores s where s.code = _code;
  if v_rid is null then return jsonb_build_object('store', null); end if;
  if not public.subscription_store_allowed(v_rid) then
    return jsonb_build_object('store', null, 'store_closed', true);
  end if;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_listings from (
    select l.id, l.selling_price, l.compare_at_price, l.custom_title, l.custom_description,
      l.extra_delivery_inside, l.extra_delivery_outside, l.created_at,
      jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug,
        'product_code', p.product_code,
        'short_description', p.short_description,
        'has_description', (p.description is not null and p.description <> ''),
        'stock', p.stock,
        'category_id', p.category_id, 'brand_id', p.brand_id,
        'category_ids', coalesce((select jsonb_agg(pc.category_id) from product_categories pc where pc.product_id = p.id), '[]'::jsonb),
        'is_featured', p.is_featured,
        'delivery_mode', coalesce(rp.delivery_mode, p.delivery_mode),
        'delivery_flat', case when rp.delivery_mode is not null then coalesce(rp.delivery_flat,0) else p.delivery_flat end,
        'delivery_inside', case when rp.delivery_mode is not null then coalesce(rp.delivery_inside,0) else p.delivery_inside end,
        'delivery_outside', case when rp.delivery_mode is not null then coalesce(rp.delivery_outside,0) else p.delivery_outside end,
        'delivery_sub', case when rp.delivery_mode is not null then coalesce(rp.delivery_sub, rp.delivery_outside, 0) else p.delivery_sub end,
        'product_images', coalesce((
          select jsonb_agg(jsonb_build_object('url', i.url, 'is_primary', i.is_primary, 'sort_order', i.sort_order)
                           order by i.sort_order, i.is_primary desc nulls last)
          from product_images i where i.product_id = p.id), '[]'::jsonb)
      ) as product
    from reseller_listings l
    join products p on p.id = l.product_id and p.is_active
    left join reseller_product_prices rp on rp.product_id = p.id and rp.reseller_id = v_rid
    where l.reseller_id = v_rid and l.is_active
    order by l.created_at desc
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_cats from (
    select c.id, c.name, c.slug, c.image_url, c.sort_order, count(distinct p.id)::int as product_count
    from categories c
    join product_categories pc on pc.category_id = c.id
    join products p on p.id = pc.product_id and p.is_active
    join reseller_listings l on l.product_id = p.id and l.reseller_id = v_rid and l.is_active
    where c.is_active
    group by c.id, c.name, c.slug, c.image_url, c.sort_order
    order by c.sort_order, c.name
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_menu from (
    select m.id, m.parent_id, m.label, m.kind, m.ref_slug, m.url, m.image_url,
           m.description, m.open_new_tab, m.layout, m.sort_order
    from reseller_menu_items m
    where m.reseller_id = v_rid and m.is_active
    order by m.sort_order, m.label
  ) t;

  select jsonb_build_object('id', g.id, 'site_name', g.site_name, 'logo_url', g.logo_url, 'favicon_url', g.favicon_url,
           'primary_color', g.primary_color, 'accent_color', g.accent_color, 'contact_email', g.contact_email,
           'contact_phone', g.contact_phone, 'label_size', g.label_size, 'privacy_policy', g.privacy_policy,
           'advanced_settings', g.advanced_settings)
    into v_settings from global_settings g where g.id = 1;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_pixels from (
    select platform, pixel_id, (reseller_id is null) as is_global
    from public_marketing_pixels where reseller_id = v_rid or reseller_id is null
  ) t;

  v_pay := public.store_payment_methods(v_rid);

  return jsonb_build_object('store', v_store, 'store_closed', false, 'listings', v_listings, 'categories', v_cats,
    'menu', v_menu, 'settings', v_settings,
    'delivery', coalesce(v_settings->'advanced_settings'->'delivery', '{}'::jsonb),
    'pixels', v_pixels, 'payment_methods', v_pay);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_public_order(
  _reseller_code text, _customer_name text, _customer_phone text, _customer_email text, _address_line text,
  _city text, _area delivery_area, _landmark text, _payment_method payment_method, _notes text, _items jsonb,
  _payment_config_id uuid DEFAULT NULL, _txn_id text DEFAULT NULL, _sender text DEFAULT NULL
)
 RETURNS TABLE(order_id uuid, order_number text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_reseller RECORD; v_order_id UUID; v_order_number TEXT;
  v_subtotal NUMERIC(12,2) := 0; v_sa_cost NUMERIC(12,2) := 0; v_ship NUMERIC(12,2) := 0;
  v_item_ship NUMERIC(12,2); v_profit NUMERIC(12,2) := 0; v_item JSONB; v_listing RECORD; v_qty INT;
  v_line NUMERIC(12,2); v_sa_line NUMERIC(12,2); v_wholesale NUMERIC(12,2);
  v_pc public.payment_configs%ROWTYPE; v_method payment_method := _payment_method;
  v_payment_config_id UUID := NULL; v_payment_provider TEXT := NULL; v_transaction_id TEXT := NULL;
  v_payment_sender TEXT := NULL; v_advance_by TEXT := NULL;
BEGIN
  _reseller_code := public.resolve_store_code(_reseller_code);
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
    v_payment_config_id, v_payment_provider, v_transaction_id, v_payment_sender, v_advance_by
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

CREATE OR REPLACE FUNCTION public.log_store_visit(_code text, _path text, _referrer text, _session_key text, _device text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF _session_key IS NULL OR length(_session_key) < 6 THEN RETURN; END IF;
  _code := public.resolve_store_code(_code);
  SELECT id INTO v_id FROM public.resellers WHERE code = _code AND status = 'active' LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.store_visits (reseller_id, path, referrer, session_key, device)
  VALUES (v_id, COALESCE(NULLIF(left(_path, 300), ''), '/'), NULLIF(left(COALESCE(_referrer,''), 300), ''),
          left(_session_key, 64), COALESCE(NULLIF(_device, ''), 'desktop'));
  IF random() < 0.02 THEN
    DELETE FROM public.store_visits WHERE created_at < now() - interval '30 days';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.capi_store_configs(p_code text, p_origin text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; c text := lower(trim(coalesce(p_code,''))); h text;
BEGIN
  IF c ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN rid := c::uuid; END IF;
  IF rid IS NULL AND c <> '' THEN
    SELECT id INTO rid FROM resellers WHERE lower(code) = lower(public.resolve_store_code(c)) LIMIT 1;
  END IF;
  FOREACH h IN ARRAY ARRAY[c, lower(coalesce(p_origin,''))] LOOP
    EXIT WHEN rid IS NOT NULL;
    h := regexp_replace(regexp_replace(regexp_replace(h,'^https?://',''),'[/:].*$',''),'^www\.','');
    IF h <> '' AND h NOT IN ('localhost','127.0.0.1') THEN
      SELECT reseller_id INTO rid FROM reseller_domains
       WHERE regexp_replace(lower(hostname),'^www\.','') = h LIMIT 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reseller_id', rid, 'configs', coalesce((
    SELECT jsonb_agg(jsonb_build_object('platform',platform,'pixel_id',pixel_id,'access_token',access_token,
      'test_event_code',test_event_code,'is_active',is_active,'reseller_id',reseller_id))
    FROM marketing_configs WHERE is_active AND (reseller_id IS NULL OR reseller_id = rid)), '[]'::jsonb));
END $$;