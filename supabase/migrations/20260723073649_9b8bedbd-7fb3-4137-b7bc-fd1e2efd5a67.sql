
-- delivery rules
CREATE TABLE public.delivery_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','brand','category','product')),
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  inside_dhaka numeric NOT NULL DEFAULT 60,
  sub_dhaka numeric NOT NULL DEFAULT 100,
  outside_dhaka numeric NOT NULL DEFAULT 130,
  free_above numeric,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_rules TO authenticated;
GRANT SELECT ON public.delivery_rules TO anon;
GRANT ALL ON public.delivery_rules TO service_role;
ALTER TABLE public.delivery_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view delivery rules" ON public.delivery_rules FOR SELECT USING (true);
CREATE POLICY "SA manages delivery rules" ON public.delivery_rules FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER upd_delivery_rules BEFORE UPDATE ON public.delivery_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- delivery calculator
CREATE OR REPLACE FUNCTION public.calculate_delivery_charge(_product_id uuid, _area text)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  charge numeric;
  brand uuid;
  category uuid;
  p_inside numeric;
  p_outside numeric;
BEGIN
  SELECT brand_id, category_id, delivery_inside, delivery_outside
    INTO brand, category, p_inside, p_outside
    FROM public.products WHERE id = _product_id;

  -- product scope
  SELECT (CASE _area WHEN 'inside_dhaka' THEN inside_dhaka WHEN 'sub_dhaka' THEN sub_dhaka ELSE outside_dhaka END)
    INTO charge
    FROM public.delivery_rules
    WHERE is_active AND scope='product' AND product_id = _product_id
    LIMIT 1;
  IF charge IS NOT NULL THEN RETURN charge; END IF;

  -- category
  IF category IS NOT NULL THEN
    SELECT (CASE _area WHEN 'inside_dhaka' THEN inside_dhaka WHEN 'sub_dhaka' THEN sub_dhaka ELSE outside_dhaka END)
      INTO charge FROM public.delivery_rules
      WHERE is_active AND scope='category' AND category_id = category LIMIT 1;
    IF charge IS NOT NULL THEN RETURN charge; END IF;
  END IF;

  -- brand
  IF brand IS NOT NULL THEN
    SELECT (CASE _area WHEN 'inside_dhaka' THEN inside_dhaka WHEN 'sub_dhaka' THEN sub_dhaka ELSE outside_dhaka END)
      INTO charge FROM public.delivery_rules
      WHERE is_active AND scope='brand' AND brand_id = brand LIMIT 1;
    IF charge IS NOT NULL THEN RETURN charge; END IF;
  END IF;

  -- global
  SELECT (CASE _area WHEN 'inside_dhaka' THEN inside_dhaka WHEN 'sub_dhaka' THEN sub_dhaka ELSE outside_dhaka END)
    INTO charge FROM public.delivery_rules
    WHERE is_active AND scope='global' LIMIT 1;
  IF charge IS NOT NULL THEN RETURN charge; END IF;

  -- fallback to product's own price
  RETURN COALESCE(CASE _area WHEN 'inside_dhaka' THEN p_inside ELSE p_outside END, 100);
END $$;

-- leader commissions
CREATE TABLE public.leader_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  base_profit numeric NOT NULL,
  rate numeric NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leader_commissions TO authenticated;
GRANT ALL ON public.leader_commissions TO service_role;
ALTER TABLE public.leader_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA sees all commissions" ON public.leader_commissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Leader sees own commissions" ON public.leader_commissions FOR SELECT TO authenticated
  USING (leader_id = public.current_reseller_id());

-- trigger to auto-create commission on delivered
CREATE OR REPLACE FUNCTION public.create_leader_commission_on_delivery()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lid uuid; rate numeric;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    SELECT leader_id, commission_rate INTO lid, rate FROM public.resellers WHERE id = NEW.reseller_id;
    IF lid IS NOT NULL AND rate IS NOT NULL AND rate > 0 AND NEW.reseller_profit > 0 THEN
      INSERT INTO public.leader_commissions (leader_id, reseller_id, order_id, base_profit, rate, amount)
      VALUES (lid, NEW.reseller_id, NEW.id, NEW.reseller_profit, rate, ROUND(NEW.reseller_profit * rate / 100, 2))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER order_delivered_commission
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.create_leader_commission_on_delivery();

-- audit log
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "SA reads audit" ON public.audit_log FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Any authed can write audit" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);
CREATE INDEX idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity, entity_id);
