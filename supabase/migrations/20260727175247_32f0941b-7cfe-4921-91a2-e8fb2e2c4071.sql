
-- Helper: generate unique short code from a seed (email/name)
CREATE OR REPLACE FUNCTION public.generate_reseller_code(_seed text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  i int := 0;
  exists_row boolean;
BEGIN
  base := lower(regexp_replace(coalesce(_seed,''), '[^a-zA-Z0-9]+', '-', 'g'));
  base := regexp_replace(base, '(^-+|-+$)', '', 'g');
  IF base IS NULL OR length(base) < 2 THEN
    base := 'store';
  END IF;
  base := left(base, 20);
  candidate := base;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.resellers WHERE code = candidate) INTO exists_row;
    EXIT WHEN NOT exists_row;
    i := i + 1;
    candidate := base || '-' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
    IF i > 20 THEN
      candidate := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN candidate;
END $$;

-- Replace new-user handler to also seed a reseller row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_phone text;
  v_email_prefix text;
  v_business text;
  v_code text;
  v_is_admin boolean;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', '');
  v_email_prefix := split_part(COALESCE(NEW.email,''), '@', 1);

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, v_name, v_phone)
  ON CONFLICT (id) DO NOTHING;

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

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create reseller rows for existing auth users that don't have one
-- (skip super admins)
INSERT INTO public.resellers (user_id, business_name, code, contact_phone, status)
SELECT
  u.id,
  COALESCE(
    NULLIF(trim(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name','')), ''),
    NULLIF(trim(split_part(COALESCE(u.email,''),'@',1)), ''),
    'New reseller'
  ) AS business_name,
  public.generate_reseller_code(COALESCE(split_part(u.email,'@',1), u.id::text)) AS code,
  NULLIF(COALESCE(u.raw_user_meta_data->>'phone',''), '') AS contact_phone,
  'pending'::reseller_status
FROM auth.users u
LEFT JOIN public.resellers r ON r.user_id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'super_admin'
WHERE r.id IS NULL AND ur.user_id IS NULL;
