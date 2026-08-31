ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS subscription_enrolled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_enrolled_at timestamptz;

CREATE OR REPLACE FUNCTION public.subscription_auto_apply()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((public.subscription_config()->>'autoApply')::boolean, true)
$$;

CREATE OR REPLACE FUNCTION public.subscription_applies(_reseller_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF _reseller_id IS NULL THEN RETURN false; END IF;
  IF NOT COALESCE((public.subscription_config()->>'enabled')::boolean, false) THEN RETURN false; END IF;
  SELECT subscription_enrolled, subscription_exempt INTO r FROM public.resellers WHERE id = _reseller_id;
  IF r IS NULL THEN RETURN false; END IF;
  IF public.subscription_auto_apply() THEN RETURN true; END IF;
  RETURN COALESCE(r.subscription_enrolled, false);
END $$;

CREATE OR REPLACE FUNCTION public.subscription_until(_reseller_id uuid)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days integer := COALESCE((public.subscription_config()->>'trialDays')::int, 0);
  r record; v_trial timestamptz;
BEGIN
  SELECT * INTO r FROM public.resellers WHERE id = _reseller_id;
  IF r.id IS NULL THEN RETURN NULL; END IF;
  v_trial := COALESCE(
    r.subscription_trial_ends_at,
    CASE WHEN v_days > 0
      THEN COALESCE(r.subscription_enrolled_at, r.created_at) + make_interval(days => v_days)
    END);
  RETURN GREATEST(r.subscription_expires_at, v_trial);
END $$;

CREATE OR REPLACE FUNCTION public.subscription_locked(_reseller_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := public.subscription_config();
  v_exempt boolean; v_until timestamptz;
BEGIN
  IF NOT public.subscription_applies(_reseller_id) THEN RETURN false; END IF;
  SELECT COALESCE(subscription_exempt, false) INTO v_exempt FROM public.resellers WHERE id = _reseller_id;
  IF v_exempt THEN RETURN false; END IF;
  v_until := public.subscription_until(_reseller_id);
  IF v_until IS NULL THEN RETURN true; END IF;
  RETURN (v_until + make_interval(days => COALESCE((cfg->>'graceDays')::int, 0))) < now();
END $$;

CREATE OR REPLACE FUNCTION public.subscription_store_allowed(_reseller_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_plan text; v_exempt boolean;
BEGIN
  IF _reseller_id IS NULL THEN RETURN true; END IF;
  IF NOT public.subscription_applies(_reseller_id) THEN RETURN true; END IF;
  SELECT subscription_plan, COALESCE(subscription_exempt, false) INTO v_plan, v_exempt
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
  r record; v_until timestamptz; v_applies boolean; v_master boolean;
BEGIN
  IF rid IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'locked', false, 'store_allowed', true);
  END IF;
  SELECT * INTO r FROM public.resellers WHERE id = rid;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'locked', false, 'store_allowed', true);
  END IF;

  v_master := COALESCE((cfg->>'enabled')::boolean, false);
  v_applies := public.subscription_applies(rid);
  v_until := public.subscription_until(rid);

  RETURN jsonb_build_object(
    'enabled', v_applies,
    'master_enabled', v_master,
    'auto_apply', public.subscription_auto_apply(),
    'enrolled', COALESCE(r.subscription_enrolled, false),
    'enrolled_at', r.subscription_enrolled_at,
    'reseller_id', rid,
    'exempt', COALESCE(r.subscription_exempt, false),
    'plan', r.subscription_plan,
    'expires_at', r.subscription_expires_at,
    'trial_ends_at', r.subscription_trial_ends_at,
    'until', v_until,
    'in_trial', (r.subscription_expires_at IS NULL OR r.subscription_expires_at <= now())
                AND v_until IS NOT NULL AND v_until > now(),
    'days_left', CASE WHEN v_until IS NULL THEN NULL
                      ELSE CEIL(EXTRACT(epoch FROM (v_until - now())) / 86400.0)::int END,
    'grace_days', COALESCE((cfg->>'graceDays')::int, 0),
    'trial_days', COALESCE((cfg->>'trialDays')::int, 0),
    'notice_days', COALESCE((cfg->>'noticeDays')::int, 7),
    'locked', public.subscription_locked(rid),
    'store_allowed', public.subscription_store_allowed(rid)
  );
END $$;

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
     SET subscription_plan = _plan,
         subscription_expires_at = v_end,
         subscription_enrolled = true,
         subscription_enrolled_at = COALESCE(subscription_enrolled_at, now()),
         updated_at = now()
   WHERE id = _reseller_id;

  RETURN row;
END $$;

CREATE OR REPLACE FUNCTION public.admin_subscription_save(_reseller_id uuid, _payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb; v_enrolled boolean;
BEGIN
  PERFORM public.assert_admin_permission(ARRAY['subscriptions.manage','resellers.manage']);

  IF _payload ? 'enrolled' THEN
    v_enrolled := COALESCE((_payload->>'enrolled')::boolean, false);
  END IF;

  UPDATE public.resellers SET
    subscription_exempt = COALESCE((_payload->>'exempt')::boolean, subscription_exempt),
    subscription_enrolled = COALESCE(v_enrolled, subscription_enrolled),
    subscription_enrolled_at = CASE
      WHEN v_enrolled IS TRUE THEN COALESCE(subscription_enrolled_at, now())
      WHEN v_enrolled IS FALSE THEN NULL
      ELSE subscription_enrolled_at END,
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

CREATE OR REPLACE FUNCTION public.subscription_trial_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg jsonb := public.subscription_config();
  v_days integer := COALESCE((cfg->>'trialDays')::int, 0);
BEGIN
  IF NOT COALESCE((cfg->>'enabled')::boolean, false) THEN RETURN NEW; END IF;
  IF NOT COALESCE((cfg->>'autoApply')::boolean, true) THEN RETURN NEW; END IF;
  NEW.subscription_enrolled := true;
  NEW.subscription_enrolled_at := COALESCE(NEW.subscription_enrolled_at, now());
  IF NEW.subscription_trial_ends_at IS NULL AND v_days > 0 THEN
    NEW.subscription_trial_ends_at := now() + make_interval(days => v_days);
  END IF;
  IF NEW.subscription_plan IS NULL THEN
    NEW.subscription_plan := COALESCE(NULLIF(cfg->>'trialPlan',''), 'panel_store');
  END IF;
  RETURN NEW;
END $$;

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
          OR NEW.subscription_exempt IS DISTINCT FROM OLD.subscription_exempt
          OR NEW.subscription_enrolled IS DISTINCT FROM OLD.subscription_enrolled
          OR NEW.subscription_enrolled_at IS DISTINCT FROM OLD.subscription_enrolled_at) THEN
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

REVOKE EXECUTE ON FUNCTION public.subscription_auto_apply() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.subscription_until(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_applies(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_locked(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.subscription_state(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.subscription_store_allowed(uuid) TO anon, authenticated;

UPDATE public.resellers
   SET subscription_enrolled = true,
       subscription_enrolled_at = COALESCE(subscription_enrolled_at, created_at)
 WHERE subscription_expires_at IS NOT NULL AND subscription_enrolled = false;