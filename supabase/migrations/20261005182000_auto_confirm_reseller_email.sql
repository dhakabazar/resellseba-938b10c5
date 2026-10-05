-- Auto confirm email for auth users and provide RPC function to prevent "Email not confirmed" errors

-- 1. Direct reseller registration function that hashes password and sets email_confirmed_at = now()
CREATE OR REPLACE FUNCTION public.register_reseller_auth(
  _email text,
  _password text,
  _full_name text,
  _phone text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(_email));
  v_phone text := trim(COALESCE(_phone, ''));
  v_name text := trim(COALESCE(_full_name, ''));
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'ইমেইল দেওয়া আবশ্যক';
  END IF;
  IF _password IS NULL OR length(_password) < 6 THEN
    RAISE EXCEPTION 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট তৈরি করা আছে। দয়া করে লগইন করুন।';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_name, 'phone', v_phone),
    now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    now(), now()
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_reseller_auth(text, text, text, text) TO anon, authenticated, service_role;

-- 2. Function to confirm auth user email by email address
CREATE OR REPLACE FUNCTION public.confirm_auth_user_by_email(_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_email;
  IF v_user_id IS NOT NULL THEN
    UPDATE auth.users
       SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
     WHERE id = v_user_id;

    UPDATE auth.identities
       SET identity_data = jsonb_set(COALESCE(identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb),
           updated_at = now()
     WHERE user_id = v_user_id AND provider = 'email';

    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_auth_user_by_email(text) TO anon, authenticated, service_role;

-- 2. Update handle_new_user to ensure auth.users.email_confirmed_at is set immediately on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name text;
  v_phone text;
  v_email_prefix text;
  v_business text;
  v_code text;
  v_is_admin boolean;
BEGIN
  -- Auto-confirm email at auth layer so password login always works
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users SET email_confirmed_at = now() WHERE id = NEW.id;
  END IF;

  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_email_prefix := split_part(COALESCE(NEW.email,''), '@', 1);

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, v_name, v_phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE public.profiles.phone END;

  -- Skip auto-reseller for super admins
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'super_admin')
    INTO v_is_admin;
  IF v_is_admin THEN
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

    INSERT INTO public.resellers (user_id, business_name, code, contact_phone, status)
    VALUES (NEW.id, v_business, v_code, NULLIF(v_phone,''), 'pending');
  END IF;

  RETURN NEW;
END $$;

-- 3. Backfill any existing unconfirmed users
UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL;
