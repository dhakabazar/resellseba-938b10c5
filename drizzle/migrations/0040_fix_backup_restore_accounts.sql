-- 1) Signup trigger must not run while a backup is being restored
--    (it would create duplicate reseller/profile rows for every restored account).
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_phone text;
  v_email_prefix text;
  v_business text;
  v_code text;
  v_is_admin boolean;
  v_is_staff boolean;
  v_dep_on boolean := false;
  v_dep_amt numeric := 0;
  v_frozen numeric := 0;
BEGIN
  IF current_setting('app.restoring', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_email_prefix := split_part(COALESCE(NEW.email,''), '@', 1);

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, v_name, v_phone)
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role IN ('super_admin','staff'))
    INTO v_is_admin;
  v_is_staff := COALESCE(NEW.raw_user_meta_data->>'is_staff', 'false') = 'true';
  IF v_is_admin OR v_is_staff THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.resellers WHERE user_id = NEW.id) THEN
    v_business := NULLIF(trim(v_name), '');
    IF v_business IS NULL THEN
      v_business := NULLIF(trim(v_email_prefix), '');
    END IF;
    IF v_business IS NULL THEN
      v_business := 'New reseller';
    END IF;
    v_code := public.generate_reseller_code(COALESCE(v_email_prefix, v_business));

    SELECT COALESCE(deposit_trigger_default_on,false), COALESCE(deposit_default_amount,0), COALESCE(deposit_default_frozen,0)
      INTO v_dep_on, v_dep_amt, v_frozen
      FROM public.global_settings WHERE id = 1;

    INSERT INTO public.resellers (user_id, business_name, code, contact_phone, status,
                                  deposit_required, deposit_required_amount, frozen_amount)
    VALUES (NEW.id, v_business, v_code, NULLIF(v_phone,''), 'pending',
            COALESCE(v_dep_on,false), COALESCE(v_dep_amt,0), COALESCE(v_frozen,0));
  END IF;

  RETURN NEW;
END $function$;

-- 2) Account restore: keep the saved password hash, fill sign-in token columns
--    with '' (NULL there breaks sign-in), skip the signup trigger, and skip
--    (not abort on) an account whose email already belongs to a different user.
CREATE OR REPLACE FUNCTION public.restore_auth_users(_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r jsonb;
  ident jsonb;
  n integer := 0;
BEGIN
  PERFORM public.backup_guard();
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only a super admin can restore a backup';
  END IF;
  IF _rows IS NULL THEN RETURN 0; END IF;
  PERFORM set_config('app.restoring', 'on', true);

  FOR r IN SELECT jsonb_array_elements(_rows) LOOP
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, phone, encrypted_password,
        email_confirmed_at, phone_confirmed_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
        banned_until, deleted_at, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        (r->>'id')::uuid,
        COALESCE(r->>'aud', 'authenticated'),
        COALESCE(r->>'role', 'authenticated'),
        r->>'email',
        NULLIF(r->>'phone', ''),
        r->>'encrypted_password',
        (r->>'email_confirmed_at')::timestamptz,
        (r->>'phone_confirmed_at')::timestamptz,
        (r->>'last_sign_in_at')::timestamptz,
        COALESCE(r->'raw_app_meta_data', '{"provider":"email","providers":["email"]}'::jsonb),
        COALESCE(r->'raw_user_meta_data', '{}'::jsonb),
        COALESCE((r->>'is_sso_user')::boolean, false),
        COALESCE((r->>'is_anonymous')::boolean, false),
        (r->>'banned_until')::timestamptz,
        (r->>'deleted_at')::timestamptz,
        COALESCE((r->>'created_at')::timestamptz, now()),
        COALESCE((r->>'updated_at')::timestamptz, now()),
        '', '', '', ''
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        phone_confirmed_at = EXCLUDED.phone_confirmed_at,
        raw_app_meta_data = EXCLUDED.raw_app_meta_data,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        banned_until = EXCLUDED.banned_until,
        deleted_at = EXCLUDED.deleted_at,
        confirmation_token = COALESCE(auth.users.confirmation_token, ''),
        recovery_token = COALESCE(auth.users.recovery_token, ''),
        email_change_token_new = COALESCE(auth.users.email_change_token_new, ''),
        email_change = COALESCE(auth.users.email_change, ''),
        updated_at = now();

      FOR ident IN SELECT jsonb_array_elements(COALESCE(r->'identities', '[]'::jsonb)) LOOP
        INSERT INTO auth.identities (
          provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
          COALESCE(ident->>'provider_id', r->>'id'),
          (r->>'id')::uuid,
          COALESCE(ident->'identity_data', jsonb_build_object('sub', r->>'id', 'email', r->>'email')),
          COALESCE(ident->>'provider', 'email'),
          (ident->>'last_sign_in_at')::timestamptz,
          COALESCE((ident->>'created_at')::timestamptz, now()),
          COALESCE((ident->>'updated_at')::timestamptz, now())
        )
        ON CONFLICT (provider_id, provider) DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          updated_at = now();
      END LOOP;

      n := n + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL; -- same email/phone already used by a different account here: keep that one
    END;
  END LOOP;
  RETURN n;
END $function$;

-- 3) Wipe keeps the restoring super admin's own admin role so the rest of the
--    restore stays authorised. Only a super admin may wipe.
CREATE OR REPLACE FUNCTION public.restore_wipe(_tables text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ordered text[];
  t text;
  i integer;
  me uuid := auth.uid();
BEGIN
  PERFORM public.backup_guard();
  IF NOT public.is_super_admin(me) THEN
    RAISE EXCEPTION 'Only a super admin can restore a backup';
  END IF;
  UPDATE public.user_roles SET custom_role_id = NULL WHERE user_id = me AND role = 'super_admin';
  ordered := public.backup_table_order();
  FOR i IN REVERSE array_length(ordered, 1)..1 LOOP
    t := ordered[i];
    IF _tables IS NULL OR t = ANY(_tables) THEN
      IF t = 'user_roles' THEN
        DELETE FROM public.user_roles WHERE NOT (user_id = me AND role = 'super_admin');
      ELSE
        EXECUTE format('DELETE FROM public.%I', t);
      END IF;
    END IF;
  END LOOP;
END $function$;