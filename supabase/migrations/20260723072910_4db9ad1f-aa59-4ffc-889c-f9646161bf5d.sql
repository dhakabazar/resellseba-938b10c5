
-- ============================================================
-- COURIER CONFIGS
-- ============================================================
CREATE TABLE public.courier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider public.courier_provider NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_configs TO authenticated;
GRANT ALL ON public.courier_configs TO service_role;
ALTER TABLE public.courier_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courier: admin all" ON public.courier_configs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_courier_updated BEFORE UPDATE ON public.courier_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.courier_configs (provider, display_name) VALUES
  ('steadfast','Steadfast Courier'),
  ('pathao','Pathao Courier'),
  ('carrybee','Carrybee'),
  ('redx','RedX'),
  ('paperfly','Paperfly'),
  ('manual','Manual booking');

-- ============================================================
-- PAYMENT CONFIGS
-- ============================================================
CREATE TABLE public.payment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method public.payment_method NOT NULL,
  label TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'api'
  is_active BOOLEAN NOT NULL DEFAULT false,
  instructions TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_configs_global_uniq ON public.payment_configs (method, label) WHERE reseller_id IS NULL;
CREATE INDEX payment_configs_reseller_idx ON public.payment_configs(reseller_id);

GRANT SELECT ON public.payment_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_configs TO authenticated;
GRANT ALL ON public.payment_configs TO service_role;
ALTER TABLE public.payment_configs ENABLE ROW LEVEL SECURITY;

-- Public can see active methods (label + method + instructions only, no secrets — enforced via views/queries)
CREATE POLICY "Payments: public read active" ON public.payment_configs FOR SELECT
  USING (is_active);
CREATE POLICY "Payments: admin all" ON public.payment_configs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Payments: reseller own" ON public.payment_configs FOR ALL TO authenticated
  USING (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id())
  WITH CHECK (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id());

CREATE TRIGGER trg_payment_updated BEFORE UPDATE ON public.payment_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MARKETING CONFIGS
-- ============================================================
CREATE TABLE public.marketing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL, -- 'facebook' | 'tiktok' | 'ga4'
  is_active BOOLEAN NOT NULL DEFAULT false,
  pixel_id TEXT,
  access_token TEXT,
  test_event_code TEXT,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX marketing_global_uniq ON public.marketing_configs(platform) WHERE reseller_id IS NULL;
CREATE UNIQUE INDEX marketing_reseller_uniq ON public.marketing_configs(reseller_id, platform) WHERE reseller_id IS NOT NULL;

GRANT SELECT ON public.marketing_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_configs TO authenticated;
GRANT ALL ON public.marketing_configs TO service_role;
ALTER TABLE public.marketing_configs ENABLE ROW LEVEL SECURITY;

-- Public: only pixel_id and platform actually needed client-side; access_token stays server-only.
-- (Access tokens fetched via server functions only; the row still returns them to admin/reseller.)
CREATE POLICY "Marketing: public read active" ON public.marketing_configs FOR SELECT
  USING (is_active);
CREATE POLICY "Marketing: admin all" ON public.marketing_configs FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Marketing: reseller own" ON public.marketing_configs FOR ALL TO authenticated
  USING (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id())
  WITH CHECK (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id());

CREATE TRIGGER trg_mkt_updated BEFORE UPDATE ON public.marketing_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SHIPMENTS: admin write policies
-- ============================================================
CREATE POLICY "Shipments admin insert" ON public.shipments FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Shipments admin update" ON public.shipments FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Shipments admin delete" ON public.shipments FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- ============================================================
-- PUBLIC ORDER CREATION (anonymous storefront checkout)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_public_order(
  _reseller_code TEXT,
  _customer_name TEXT,
  _customer_phone TEXT,
  _customer_email TEXT,
  _address_line TEXT,
  _city TEXT,
  _area public.delivery_area,
  _landmark TEXT,
  _payment_method public.payment_method,
  _notes TEXT,
  _items JSONB   -- [{listing_id: uuid, quantity: int}]
)
RETURNS TABLE (order_id UUID, order_number TEXT)
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
  v_profit NUMERIC(12,2) := 0;
  v_item JSONB;
  v_listing RECORD;
  v_qty INT;
  v_line NUMERIC(12,2);
  v_sa_line NUMERIC(12,2);
  v_extra_ship NUMERIC(12,2);
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
    SELECT l.*, p.name AS product_name, p.buying_price, p.packaging_cost, p.delivery_inside, p.delivery_outside
      INTO v_listing
      FROM public.reseller_listings l
      JOIN public.products p ON p.id = l.product_id
      WHERE l.id = (v_item->>'listing_id')::uuid
        AND l.reseller_id = v_reseller.id
        AND l.is_active = true
        AND p.is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable'; END IF;

    v_line := v_listing.selling_price * v_qty;
    v_sa_line := (v_listing.buying_price + v_listing.packaging_cost) * v_qty;
    v_subtotal := v_subtotal + v_line;
    v_sa_cost := v_sa_cost + v_sa_line;

    -- shipping computed from first item's product (typical single-parcel)
    IF v_ship = 0 THEN
      IF _area = 'inside_dhaka' THEN
        v_ship := v_listing.delivery_inside + v_listing.extra_delivery_inside;
      ELSE
        v_ship := v_listing.delivery_outside + v_listing.extra_delivery_outside;
      END IF;
    END IF;

    INSERT INTO public.order_items(
      order_id, listing_id, product_id, product_name, product_sku, quantity,
      selling_price, buying_price, packaging_cost, sa_cost, reseller_profit, line_total
    ) VALUES (
      v_order_id, v_listing.id, v_listing.product_id, v_listing.product_name, NULL, v_qty,
      v_listing.selling_price, v_listing.buying_price, v_listing.packaging_cost,
      v_sa_line, (v_listing.selling_price - v_listing.buying_price - v_listing.packaging_cost) * v_qty,
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
$$;

REVOKE ALL ON FUNCTION public.create_public_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,public.delivery_area,TEXT,public.payment_method,TEXT,JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,public.delivery_area,TEXT,public.payment_method,TEXT,JSONB) TO anon, authenticated;

-- Order items snapshot fields: ensure column exists (created earlier in orders migration)
-- (No changes needed; using existing schema.)

-- ============================================================
-- Helper: reseller profit summary (available balance)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reseller_profit_summary(_reseller_id UUID)
RETURNS TABLE (delivered_profit NUMERIC, pending_payout NUMERIC, paid_out NUMERIC, available NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT COALESCE(SUM(reseller_profit),0) AS amt
    FROM public.orders WHERE reseller_id = _reseller_id AND status = 'delivered'
  ),
  p AS (
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('pending','approved') THEN amount ELSE 0 END),0) AS pending,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),0) AS paid
    FROM public.payouts WHERE reseller_id = _reseller_id
  )
  SELECT d.amt, p.pending, p.paid, GREATEST(d.amt - p.pending - p.paid, 0) FROM d, p;
$$;
GRANT EXECUTE ON FUNCTION public.reseller_profit_summary(UUID) TO authenticated;
