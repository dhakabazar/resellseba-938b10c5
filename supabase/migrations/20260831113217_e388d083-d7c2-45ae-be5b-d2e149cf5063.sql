CREATE TABLE public.reseller_product_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reseller_price numeric(12,2) NOT NULL CHECK (reseller_price >= 0),
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, product_id)
);

CREATE INDEX idx_rpp_reseller ON public.reseller_product_prices(reseller_id);
CREATE INDEX idx_rpp_product ON public.reseller_product_prices(product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_product_prices TO authenticated;
GRANT ALL ON public.reseller_product_prices TO service_role;

ALTER TABLE public.reseller_product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reseller prices"
ON public.reseller_product_prices FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['reseller_pricing.manage','products.manage','resellers.manage']))
WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['reseller_pricing.manage','products.manage','resellers.manage']));

CREATE POLICY "Reseller reads own prices"
ON public.reseller_product_prices FOR SELECT TO authenticated
USING (reseller_id = public.current_reseller_id());

CREATE POLICY "Agent reads assigned reseller prices"
ON public.reseller_product_prices FOR SELECT TO authenticated
USING (public.agent_owns_reseller(reseller_id));

CREATE TRIGGER trg_rpp_updated_at
BEFORE UPDATE ON public.reseller_product_prices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pgc();

INSERT INTO public.permissions (name, label, description, group_key, group_label, sort_order)
VALUES ('reseller_pricing.manage', 'Reseller pricing', 'Set custom per-reseller product prices', 'growth', 'Growth', 30)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reseller_wholesale_price(_reseller_id uuid, _product_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT rp.reseller_price FROM public.reseller_product_prices rp
      WHERE rp.reseller_id = _reseller_id AND rp.product_id = _product_id),
    (SELECT p.reseller_price FROM public.products p WHERE p.id = _product_id),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.reseller_catalog_page()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (select id from resellers where user_id = auth.uid() limit 1)
  select jsonb_build_object(
    'reseller_id', (select id from me),
    'products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'slug', p.slug, 'product_code', p.product_code,
        'reseller_price', coalesce(rp.reseller_price, p.reseller_price),
        'base_reseller_price', p.reseller_price,
        'has_custom_price', (rp.reseller_price is not null),
        'packaging_cost', p.packaging_cost,
        'delivery_inside', p.delivery_inside, 'delivery_outside', p.delivery_outside,
        'delivery_sub', p.delivery_sub, 'delivery_mode', p.delivery_mode,
        'delivery_flat', p.delivery_flat, 'suggested_price', p.suggested_price,
        'stock', p.stock, 'og_image_url', p.og_image_url,
        'brand_id', p.brand_id, 'category_id', p.category_id
      ) order by p.created_at desc), '[]'::jsonb)
      from products p
      left join reseller_product_prices rp
        on rp.product_id = p.id and rp.reseller_id = (select id from me)
      where p.is_active
    ),
    'brands', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name), '[]'::jsonb)
      from brands b where b.is_active
    ),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb)
      from categories c where c.is_active
    ),
    'listed_product_ids', (
      select coalesce(jsonb_agg(l.product_id), '[]'::jsonb)
      from reseller_listings l where l.reseller_id = (select id from me)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_public_order(_reseller_code text, _customer_name text, _customer_phone text, _customer_email text, _address_line text, _city text, _area delivery_area, _landmark text, _payment_method payment_method, _notes text, _items jsonb)
 RETURNS TABLE(order_id uuid, order_number text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    -- Per-reseller custom wholesale price wins over the master product price.
    v_wholesale := COALESCE(
      (SELECT rp.reseller_price FROM public.reseller_product_prices rp
        WHERE rp.reseller_id = v_reseller.id AND rp.product_id = v_listing.product_id),
      v_listing.reseller_price);

    v_line := v_listing.selling_price * v_qty;
    v_sa_line := (v_wholesale + v_listing.packaging_cost) * v_qty;
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
      v_wholesale + v_listing.packaging_cost, v_listing.selling_price,
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
$function$;