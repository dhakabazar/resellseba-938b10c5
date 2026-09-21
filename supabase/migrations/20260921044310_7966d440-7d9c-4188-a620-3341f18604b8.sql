-- Backup / restore engine: fully dynamic over the public schema + auth accounts.

INSERT INTO public.permissions (name, description, group_key, group_label, label, sort_order)
VALUES ('backup.manage', 'Create and restore full backups', 'system', 'System', 'Backup & restore', 90)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.backup_guard()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF public.is_super_admin(auth.uid()) THEN RETURN; END IF;
  IF public.has_any_permission(auth.uid(), ARRAY['backup.manage','settings.manage']) THEN RETURN; END IF;
  RAISE EXCEPTION 'Forbidden';
END $$;

CREATE OR REPLACE FUNCTION public.backup_table_order()
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  remaining text[];
  ordered text[] := '{}';
  t text;
  progressed boolean;
  parents text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  remaining := COALESCE(remaining, '{}');

  LOOP
    progressed := false;
    FOREACH t IN ARRAY remaining LOOP
      IF t = ANY(ordered) THEN CONTINUE; END IF;
      SELECT COALESCE(array_agg(DISTINCT pf.relname), '{}') INTO parents
      FROM pg_constraint con
      JOIN pg_class pc ON pc.oid = con.conrelid
      JOIN pg_class pf ON pf.oid = con.confrelid
      JOIN pg_namespace nf ON nf.oid = pf.relnamespace
      WHERE con.contype = 'f' AND pc.relname = t
        AND pc.relnamespace = 'public'::regnamespace
        AND nf.nspname = 'public' AND pf.relname <> t;

      IF parents <@ ordered THEN
        ordered := ordered || t;
        progressed := true;
      END IF;
    END LOOP;
    EXIT WHEN NOT progressed;
  END LOOP;

  FOREACH t IN ARRAY remaining LOOP
    IF NOT (t = ANY(ordered)) THEN ordered := ordered || t; END IF;
  END LOOP;

  RETURN ordered;
END $$;

CREATE OR REPLACE FUNCTION public.backup_manifest()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tables text[];
  t text;
  n bigint;
  out_tables jsonb := '[]'::jsonb;
  users bigint;
BEGIN
  PERFORM public.backup_guard();
  tables := public.backup_table_order();
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    out_tables := out_tables || jsonb_build_object('name', t, 'rows', n);
  END LOOP;
  SELECT count(*) INTO users FROM auth.users;
  RETURN jsonb_build_object(
    'version', 1,
    'generated_at', now(),
    'tables', out_tables,
    'users', users
  );
END $$;

CREATE OR REPLACE FUNCTION public.backup_rows(_table text, _offset integer DEFAULT 0, _limit integer DEFAULT 2000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  PERFORM public.backup_guard();
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname = _table
  ) THEN RAISE EXCEPTION 'Unknown table %', _table; END IF;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM (SELECT * FROM public.%I ORDER BY ctid OFFSET %s LIMIT %s) t',
    _table, GREATEST(_offset, 0), GREATEST(_limit, 1)
  ) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.backup_auth_users(_offset integer DEFAULT 0, _limit integer DEFAULT 2000)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  PERFORM public.backup_guard();
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO res FROM (
    SELECT jsonb_build_object(
      'id', u.id,
      'aud', u.aud,
      'role', u.role,
      'email', u.email,
      'phone', u.phone,
      'encrypted_password', u.encrypted_password,
      'email_confirmed_at', u.email_confirmed_at,
      'phone_confirmed_at', u.phone_confirmed_at,
      'confirmed_at', u.confirmed_at,
      'last_sign_in_at', u.last_sign_in_at,
      'raw_app_meta_data', u.raw_app_meta_data,
      'raw_user_meta_data', u.raw_user_meta_data,
      'is_sso_user', u.is_sso_user,
      'is_anonymous', u.is_anonymous,
      'banned_until', u.banned_until,
      'deleted_at', u.deleted_at,
      'created_at', u.created_at,
      'updated_at', u.updated_at,
      'identities', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'provider_id', i.provider_id,
          'provider', i.provider,
          'identity_data', i.identity_data,
          'email', i.email,
          'last_sign_in_at', i.last_sign_in_at,
          'created_at', i.created_at,
          'updated_at', i.updated_at
        )), '[]'::jsonb) FROM auth.identities i WHERE i.user_id = u.id
      )
    ) AS row
    FROM auth.users u
    ORDER BY u.created_at NULLS LAST, u.id
    OFFSET GREATEST(_offset, 0) LIMIT GREATEST(_limit, 1)
  ) s;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.restore_set_triggers(_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text;
BEGIN
  PERFORM public.backup_guard();
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    IF _enabled THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    ELSE
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.restore_wipe(_tables text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ordered text[];
  t text;
  i integer;
BEGIN
  PERFORM public.backup_guard();
  ordered := public.backup_table_order();
  FOR i IN REVERSE array_length(ordered, 1)..1 LOOP
    t := ordered[i];
    IF _tables IS NULL OR t = ANY(_tables) THEN
      EXECUTE format('DELETE FROM public.%I', t);
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.restore_rows(_table text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cols text;
  n integer := 0;
BEGIN
  PERFORM public.backup_guard();
  IF _rows IS NULL OR jsonb_array_length(_rows) = 0 THEN RETURN 0; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n2 ON n2.oid = c.relnamespace
    WHERE n2.nspname='public' AND c.relkind='r' AND c.relname = _table
  ) THEN RETURN 0; END IF;

  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=_table
    AND column_name IN (SELECT jsonb_object_keys(_rows->0));

  IF cols IS NULL THEN RETURN 0; END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT DO NOTHING',
    _table, cols, cols, _table
  ) USING _rows;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.restore_auth_users(_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r jsonb;
  ident jsonb;
  n integer := 0;
BEGIN
  PERFORM public.backup_guard();
  IF _rows IS NULL THEN RETURN 0; END IF;

  FOR r IN SELECT jsonb_array_elements(_rows) LOOP
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, phone, encrypted_password,
      email_confirmed_at, phone_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
      banned_until, deleted_at, created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      (r->>'id')::uuid,
      COALESCE(r->>'aud', 'authenticated'),
      COALESCE(r->>'role', 'authenticated'),
      r->>'email',
      r->>'phone',
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
      COALESCE((r->>'updated_at')::timestamptz, now())
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
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.backup_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backup_table_order() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backup_manifest() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backup_rows(text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backup_auth_users(integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_set_triggers(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_wipe(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_rows(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_auth_users(jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.backup_manifest() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backup_rows(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backup_auth_users(integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_set_triggers(boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_wipe(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_rows(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_auth_users(jsonb) TO authenticated, service_role;