-- ============ 1. Global plan pricing ============
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan text NOT NULL CHECK (plan IN ('panel','panel_store')),
  months integer NOT NULL CHECK (months IN (1,6,12)),
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan, months)
);
GRANT SELECT ON public.subscription_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are readable" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Managers write plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','settings.manage']))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','settings.manage']));

INSERT INTO public.subscription_plans (plan, months, price) VALUES
  ('panel', 1, 500), ('panel', 6, 2750), ('panel', 12, 5000),
  ('panel_store', 1, 1000), ('panel_store', 6, 5500), ('panel_store', 12, 10000);

-- ============ 2. Per-reseller price override ============
CREATE TABLE public.reseller_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('panel','panel_store')),
  months integer NOT NULL CHECK (months IN (1,6,12)),
  price numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_id, plan, months)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_plan_prices TO authenticated;
GRANT ALL ON public.reseller_plan_prices TO service_role;
ALTER TABLE public.reseller_plan_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or managed prices readable" ON public.reseller_plan_prices FOR SELECT TO authenticated
  USING (reseller_id = public.current_reseller_id()
         OR public.is_super_admin(auth.uid())
         OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','subscriptions.view','resellers.manage','resellers.view_all']));
CREATE POLICY "Managers write prices" ON public.reseller_plan_prices FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','resellers.manage']))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','resellers.manage']));

-- ============ 3. Reseller columns ============
ALTER TABLE public.resellers
  ADD COLUMN subscription_plan text CHECK (subscription_plan IN ('panel','panel_store')),
  ADD COLUMN subscription_expires_at timestamptz,
  ADD COLUMN subscription_trial_ends_at timestamptz,
  ADD COLUMN subscription_exempt boolean NOT NULL DEFAULT false;

-- ============ 4. Subscription history ============
CREATE TABLE public.reseller_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('panel','panel_store')),
  months integer NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'paid' CHECK (source IN ('paid','manual','trial','online')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reseller_subscriptions_reseller_idx ON public.reseller_subscriptions(reseller_id, created_at DESC);
GRANT SELECT ON public.reseller_subscriptions TO authenticated;
GRANT ALL ON public.reseller_subscriptions TO service_role;
ALTER TABLE public.reseller_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or managed subscriptions readable" ON public.reseller_subscriptions FOR SELECT TO authenticated
  USING (reseller_id = public.current_reseller_id()
         OR public.is_super_admin(auth.uid())
         OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','subscriptions.view','resellers.manage','resellers.view_all','finance.view']));

-- ============ 5. Payment requests ============
CREATE TABLE public.subscription_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('panel','panel_store')),
  months integer NOT NULL CHECK (months IN (1,6,12)),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_config_id uuid REFERENCES public.payment_configs(id) ON DELETE SET NULL,
  method text,
  provider text,
  reference text,
  txn_id text,
  code text UNIQUE,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  paid_at timestamptz,
  subscription_id uuid REFERENCES public.reseller_subscriptions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_requests_reseller_idx ON public.subscription_requests(reseller_id, created_at DESC);
CREATE INDEX subscription_requests_status_idx ON public.subscription_requests(status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_requests TO authenticated;
GRANT ALL ON public.subscription_requests TO service_role;
ALTER TABLE public.subscription_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or managed requests readable" ON public.subscription_requests FOR SELECT TO authenticated
  USING (reseller_id = public.current_reseller_id()
         OR public.is_super_admin(auth.uid())
         OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','subscriptions.view','resellers.manage','resellers.view_all','finance.view']));
CREATE POLICY "Reseller creates own request" ON public.subscription_requests FOR INSERT TO authenticated
  WITH CHECK (reseller_id = public.current_reseller_id() AND status = 'pending');
CREATE POLICY "Managers update requests" ON public.subscription_requests FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','resellers.manage']))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','resellers.manage']));
CREATE POLICY "Managers delete requests" ON public.subscription_requests FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','resellers.manage']));

CREATE TRIGGER subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pgc();
CREATE TRIGGER reseller_plan_prices_updated_at BEFORE UPDATE ON public.reseller_plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pgc();
CREATE TRIGGER subscription_requests_updated_at BEFORE UPDATE ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pgc();

-- ============ 6. Permissions ============
INSERT INTO public.permissions (name, label, description, group_key, group_label, sort_order)
VALUES
  ('subscriptions.view', 'View subscriptions', 'See reseller packages, prices and payment requests', 'subscriptions', 'Subscriptions', 10),
  ('subscriptions.manage', 'Manage subscriptions', 'Edit package prices, approve payments, extend or exempt resellers', 'subscriptions', 'Subscriptions', 20)
ON CONFLICT (name) DO NOTHING;

-- ============ 7. Helper functions ============
CREATE OR REPLACE FUNCTION public.subscription_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(g.advanced_settings->'subscription', '{}'::jsonb) FROM public.global_settings g WHERE g.id = 1
$$;

CREATE OR REPLACE FUNCTION public.subscription_price(_reseller_id uuid, _plan text, _months integer)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT rp.price FROM public.reseller_plan_prices rp
      WHERE rp.reseller_id = _reseller_id AND rp.plan = _plan AND rp.months = _months),
    (SELECT sp.price FROM public.subscription_plans sp WHERE sp.plan = _plan AND sp.months = _months),
    0)
$$;

CREATE OR REPLACE FUNCTION public.subscription_options(_reseller_id uuid DEFAULT NULL)
RETURNS TABLE (plan_key text, months integer, price numeric, base_price numeric, is_custom boolean, active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sp.plan, sp.months, COALESCE(rp.price, sp.price), sp.price, rp.price IS NOT NULL, sp.is_active
  FROM public.subscription_plans sp
  LEFT JOIN public.reseller_plan_prices rp
    ON rp.plan = sp.plan AND rp.months = sp.months AND rp.reseller_id = _reseller_id
  ORDER BY sp.plan, sp.months
$$;

-- Effective end of access: later of paid expiry and free-trial end.
CREATE OR REPLACE FUNCTION public.subscription_until(_reseller_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT GREATEST(r.subscription_expires_at, r.subscription_trial_ends_at)
  FROM public.resellers r WHERE r.id = _reseller_id
$$;

CREATE OR REPLACE FUNCTION public.subscription_locked(_reseller_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := public.subscription_config();
  r record; v_until timestamptz;
BEGIN
  IF _reseller_id IS NULL THEN RETURN false; END IF;
  IF NOT COALESCE((cfg->>'enabled')::boolean, false) THEN RETURN false; END IF;
  SELECT subscription_exempt, subscription_expires_at, subscription_trial_ends_at
    INTO r FROM public.resellers WHERE id = _reseller_id;
  IF r IS NULL OR COALESCE(r.subscription_exempt, false) THEN RETURN false; END IF;
  v_until := GREATEST(r.subscription_expires_at, r.subscription_trial_ends_at);
  IF v_until IS NULL THEN RETURN true; END IF;
  RETURN (v_until + make_interval(days => COALESCE((cfg->>'graceDays')::int, 0))) < now();
END $$;

CREATE OR REPLACE FUNCTION public.subscription_store_allowed(_reseller_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := public.subscription_config();
  v_plan text; v_exempt boolean;
BEGIN
  IF _reseller_id IS NULL THEN RETURN true; END IF;
  IF NOT COALESCE((cfg->>'enabled')::boolean, false) THEN RETURN true; END IF;
  SELECT subscription_plan, COALESCE(subscription_exempt,false) INTO v_plan, v_exempt
    FROM public.resellers WHERE id = _reseller_id;
  IF v_exempt THEN RETURN true; END IF;
  IF public.subscription_locked(_reseller_id) THEN RETURN false; END IF;
  RETURN COALESCE(v_plan, 'panel_store') = 'panel_store';
END $$;

CREATE OR REPLACE FUNCTION public.subscription_state(_reseller_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := public.subscription_config();
  rid uuid := COALESCE(_reseller_id, public.current_reseller_id());
  r record; v_until timestamptz; v_enabled boolean;
BEGIN
  IF rid IS NULL THEN RETURN jsonb_build_object('enabled', false, 'locked', false, 'store_allowed', true); END IF;
  SELECT * INTO r FROM public.resellers WHERE id = rid;
  IF r.id IS NULL THEN RETURN jsonb_build_object('enabled', false, 'locked', false, 'store_allowed', true); END IF;
  v_enabled := COALESCE((cfg->>'enabled')::boolean, false);
  v_until := GREATEST(r.subscription_expires_at, r.subscription_trial_ends_at);
  RETURN jsonb_build_object(
    'enabled', v_enabled,
    'reseller_id', rid,
    'exempt', COALESCE(r.subscription_exempt, false),
    'plan', r.subscription_plan,
    'expires_at', r.subscription_expires_at,
    'trial_ends_at', r.subscription_trial_ends_at,
    'until', v_until,
    'in_trial', (r.subscription_trial_ends_at IS NOT NULL AND r.subscription_trial_ends_at > now()
                 AND (r.subscription_expires_at IS NULL OR r.subscription_expires_at <= now())),
    'days_left', CASE WHEN v_until IS NULL THEN NULL
                      ELSE CEIL(EXTRACT(epoch FROM (v_until - now())) / 86400.0)::int END,
    'grace_days', COALESCE((cfg->>'graceDays')::int, 0),
    'trial_days', COALESCE((cfg->>'trialDays')::int, 0),
    'locked', public.subscription_locked(rid),
    'store_allowed', public.subscription_store_allowed(rid)
  );
END $$;

-- ============ 8. Activation ============
CREATE OR REPLACE FUNCTION public.subscription_apply(
  _reseller_id uuid, _plan text, _months integer, _amount numeric,
  _source text DEFAULT 'paid', _note text DEFAULT NULL, _actor uuid DEFAULT NULL)
RETURNS public.reseller_subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_start timestamptz; v_end timestamptz; row public.reseller_subscriptions;
BEGIN
  SELECT GREATEST(now(), COALESCE(subscription_expires_at, now())) INTO v_start
    FROM public.resellers WHERE id = _reseller_id;
  IF v_start IS NULL THEN RAISE EXCEPTION 'Reseller not found'; END IF;
  v_end := v_start + make_interval(months => _months);

  INSERT INTO public.reseller_subscriptions (reseller_id, plan, months, amount, source, starts_at, ends_at, note, created_by)
  VALUES (_reseller_id, _plan, _months, COALESCE(_amount, 0), _source, v_start, v_end, _note, _actor)
  RETURNING * INTO row;

  UPDATE public.resellers
     SET subscription_plan = _plan, subscription_expires_at = v_end, updated_at = now()
   WHERE id = _reseller_id;

  RETURN row;
END $$;
REVOKE ALL ON FUNCTION public.subscription_apply(uuid, text, integer, numeric, text, text, uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.subscription_request_review(_id uuid, _approve boolean, _admin_note text DEFAULT NULL)
RETURNS public.subscription_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.subscription_requests; sub public.reseller_subscriptions;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['subscriptions.manage','resellers.manage','finance.view']);
  SELECT * INTO req FROM public.subscription_requests WHERE id = _id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Payment request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'This request is already %', req.status; END IF;

  IF NOT _approve THEN
    UPDATE public.subscription_requests
       SET status = 'rejected', admin_note = COALESCE(_admin_note, admin_note),
           reviewed_by = auth.uid(), reviewed_at = now()
     WHERE id = _id RETURNING * INTO req;
    RETURN req;
  END IF;

  sub := public.subscription_apply(req.reseller_id, req.plan, req.months, req.amount, 'paid',
           COALESCE(NULLIF(req.note,''), 'Package payment'), auth.uid());

  UPDATE public.subscription_requests
     SET status = 'approved', admin_note = COALESCE(_admin_note, admin_note),
         reviewed_by = auth.uid(), reviewed_at = now(),
         paid_at = COALESCE(paid_at, now()), subscription_id = sub.id
   WHERE id = _id RETURNING * INTO req;
  RETURN req;
END $$;

-- Admin: manual grant / expire / exempt / trial / custom price
CREATE OR REPLACE FUNCTION public.admin_subscription_extend(
  _reseller_id uuid, _plan text, _months integer, _amount numeric DEFAULT NULL, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sub public.reseller_subscriptions;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['subscriptions.manage','resellers.manage']);
  sub := public.subscription_apply(_reseller_id, _plan, _months,
           COALESCE(_amount, public.subscription_price(_reseller_id, _plan, _months)),
           'manual', _note, auth.uid());
  RETURN public.subscription_state(_reseller_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_subscription_save(_reseller_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['subscriptions.manage','resellers.manage']);

  UPDATE public.resellers SET
    subscription_exempt = COALESCE((_payload->>'exempt')::boolean, subscription_exempt),
    subscription_plan = CASE WHEN _payload ? 'plan'
                             THEN NULLIF(_payload->>'plan','') ELSE subscription_plan END,
    subscription_expires_at = CASE WHEN _payload ? 'expires_at'
                                   THEN NULLIF(_payload->>'expires_at','')::timestamptz ELSE subscription_expires_at END,
    subscription_trial_ends_at = CASE WHEN _payload ? 'trial_ends_at'
                                      THEN NULLIF(_payload->>'trial_ends_at','')::timestamptz ELSE subscription_trial_ends_at END,
    updated_at = now()
  WHERE id = _reseller_id;

  IF _payload ? 'prices' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(_payload->'prices') LOOP
      IF (item->>'price') IS NULL OR (item->>'price') = '' THEN
        DELETE FROM public.reseller_plan_prices
         WHERE reseller_id = _reseller_id AND plan = item->>'plan' AND months = (item->>'months')::int;
      ELSE
        INSERT INTO public.reseller_plan_prices (reseller_id, plan, months, price, note, created_by)
        VALUES (_reseller_id, item->>'plan', (item->>'months')::int, (item->>'price')::numeric,
                NULLIF(item->>'note',''), auth.uid())
        ON CONFLICT (reseller_id, plan, months)
        DO UPDATE SET price = EXCLUDED.price, note = EXCLUDED.note, updated_at = now();
      END IF;
    END LOOP;
  END IF;

  RETURN public.subscription_state(_reseller_id);
END $$;

-- Admin/reseller read: state + options + history + requests in one call
CREATE OR REPLACE FUNCTION public.subscription_overview(_reseller_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rid uuid := COALESCE(_reseller_id, public.current_reseller_id());
BEGIN
  IF rid IS NULL THEN RETURN jsonb_build_object('state', jsonb_build_object('enabled', false)); END IF;
  IF rid <> COALESCE(public.current_reseller_id(), '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.has_any_permission(auth.uid(), ARRAY['subscriptions.manage','subscriptions.view','resellers.manage','resellers.view_all','finance.view'])
     AND NOT public.agent_owns_reseller(rid) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN jsonb_build_object(
    'state', public.subscription_state(rid),
    'options', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                  'plan', o.plan_key, 'months', o.months, 'price', o.price,
                  'base_price', o.base_price, 'is_custom', o.is_custom, 'active', o.active)), '[]'::jsonb)
                FROM public.subscription_options(rid) o),
    'history', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC), '[]'::jsonb)
                FROM public.reseller_subscriptions s WHERE s.reseller_id = rid),
    'requests', (SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
                 FROM public.subscription_requests q WHERE q.reseller_id = rid)
  );
END $$;

-- ============ 9. Request amount is server-controlled ============
CREATE OR REPLACE FUNCTION public.subscription_request_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.amount := public.subscription_price(NEW.reseller_id, NEW.plan, NEW.months);
  IF NEW.amount <= 0 THEN RAISE EXCEPTION 'This package has no price yet — contact admin'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subscription_requests_price BEFORE INSERT ON public.subscription_requests
  FOR EACH ROW EXECUTE FUNCTION public.subscription_request_price();

-- ============ 10. Free trial for new resellers ============
CREATE OR REPLACE FUNCTION public.subscription_trial_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_days integer := COALESCE((public.subscription_config()->>'trialDays')::int, 0);
BEGIN
  IF NEW.subscription_trial_ends_at IS NULL AND v_days > 0 THEN
    NEW.subscription_trial_ends_at := now() + make_interval(days => v_days);
  END IF;
  IF NEW.subscription_plan IS NULL THEN
    NEW.subscription_plan := COALESCE(NULLIF(public.subscription_config()->>'trialPlan',''), 'panel_store');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER resellers_subscription_trial BEFORE INSERT ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.subscription_trial_on_insert();

-- ============ 11. Read-only lock when the package expired ============
CREATE OR REPLACE FUNCTION public.enforce_subscription_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rid uuid := NEW.reseller_id;
BEGIN
  IF v_rid IS NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_any_permission(auth.uid(), ARRAY['orders.edit','resellers.manage','subscriptions.manage','finance.view']) THEN
    RETURN NEW;
  END IF;
  IF public.subscription_locked(v_rid) THEN
    RAISE EXCEPTION 'Your monthly package has expired. Renew the package to continue — the panel is read-only until then.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER orders_subscription_gate BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_gate();
CREATE TRIGGER listings_subscription_gate BEFORE INSERT OR UPDATE ON public.reseller_listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_gate();

-- ============ 12. Protect subscription fields from non-managers ============
CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promote boolean := false;
  v_uid uuid := auth.uid();
  v_full boolean;
  v_edit boolean;
  v_deposit boolean;
  v_sub boolean;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'pending' AND public.reseller_auto_approve() THEN
    NEW.status := 'active';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    v_promote := true;
  END IF;

  v_full := v_uid IS NULL
            OR public.is_super_admin(v_uid)
            OR public.has_permission(v_uid, 'resellers.manage');

  IF v_full THEN
    RETURN NEW;
  END IF;

  v_edit := public.has_permission(v_uid, 'resellers.edit');
  v_deposit := public.has_permission(v_uid, 'resellers.deposit');
  v_sub := public.has_permission(v_uid, 'subscriptions.manage');

  IF NOT v_promote AND NOT v_edit
     AND (NEW.status IS DISTINCT FROM OLD.status
          OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    RAISE EXCEPTION 'Not allowed to change reseller status';
  END IF;

  IF NOT v_edit AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to change reseller notes';
  END IF;

  IF NOT v_deposit
     AND (NEW.deposit_required IS DISTINCT FROM OLD.deposit_required
          OR NEW.deposit_required_amount IS DISTINCT FROM OLD.deposit_required_amount
          OR NEW.frozen_amount IS DISTINCT FROM OLD.frozen_amount) THEN
    RAISE EXCEPTION 'Not allowed to change reseller deposit settings';
  END IF;

  IF NOT v_sub
     AND (NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
          OR NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at
          OR NEW.subscription_trial_ends_at IS DISTINCT FROM OLD.subscription_trial_ends_at
          OR NEW.subscription_exempt IS DISTINCT FROM OLD.subscription_exempt) THEN
    RAISE EXCEPTION 'Not allowed to change reseller subscription settings';
  END IF;

  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;

  RETURN NEW;
END $$;

-- ============ 13. Panel & store bootstrap carry the package state ============
CREATE OR REPLACE FUNCTION public.panel_bootstrap()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  uid uuid := auth.uid();
  r record;
  res jsonb;
begin
  if uid is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select * into r from resellers where user_id = uid limit 1;

  res := jsonb_build_object(
    'signed_in', true,
    'settings', (select to_jsonb(g) from global_settings g where g.id = 1),
    'roles', (select coalesce(jsonb_agg(ur.role), '[]'::jsonb) from user_roles ur where ur.user_id = uid),
    'permissions', to_jsonb(public.my_permissions()),
    'verify', (select to_jsonb(v) from public.verify_state() v),
    'reseller', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'code', r.code, 'business_name', r.business_name, 'status', r.status,
      'avatar_url', r.avatar_url, 'deposit_required', r.deposit_required,
      'deposit_required_amount', r.deposit_required_amount, 'frozen_amount', r.frozen_amount,
      'subscription_plan', r.subscription_plan,
      'subscription_expires_at', r.subscription_expires_at,
      'subscription_trial_ends_at', r.subscription_trial_ends_at,
      'subscription_exempt', r.subscription_exempt
    ) end,
    'subscription', case when r.id is null then null else public.subscription_state(r.id) end,
    'reseller_settings', case when r.id is null then null else
      (select jsonb_build_object('logo_url', s.logo_url, 'primary_color', s.primary_color)
       from reseller_settings s where s.reseller_id = r.id) end,
    'deposits', case when r.id is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id, 'amount', d.amount, 'method', d.method,
          'reference', d.reference, 'note', d.note, 'created_at', d.created_at
        ) order by d.created_at desc), '[]'::jsonb)
       from reseller_deposits d where d.reseller_id = r.id) end,
    'notices', (
      select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
      from admin_notices n
      where n.is_active
        and (n.starts_at is null or n.starts_at <= now())
        and (n.ends_at is null or n.ends_at >= now())
        and (coalesce(array_length(n.target_reseller_ids, 1), 0) = 0
             or (r.id is not null and r.id = any (n.target_reseller_ids)))
        and not exists (
          select 1 from admin_notice_dismissals d
          where d.notice_id = n.id and d.user_id = uid
        )
    )
  );

  return res;
end;
$$;
