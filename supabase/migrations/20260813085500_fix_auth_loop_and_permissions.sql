-- 1. Ensure the has_permission function exists and is robust
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super admins have all permissions
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'super_admin'
  ) THEN
    RETURN true;
  END IF;

  -- Check roles assigned to user and their permissions
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role::text = rp.role_name
    WHERE ur.user_id = _user_id
      AND rp.permission_name = _permission
  );
END;
$$;

-- 2. Create the my_permissions function that use-auth.ts calls
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _perms text[];
BEGIN
  IF _user_id IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  -- If super admin, return a special token or all known permissions
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') THEN
    SELECT array_agg(DISTINCT name) INTO _perms FROM public.permissions;
    -- Fallback if permissions table is empty
    IF _perms IS NULL THEN
        _perms := ARRAY['*']; 
    END IF;
    RETURN _perms;
  END IF;

  SELECT array_agg(DISTINCT rp.permission_name)
  INTO _perms
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON ur.role::text = rp.role_name
  WHERE ur.user_id = _user_id;

  RETURN COALESCE(_perms, ARRAY[]::text[]);
END;
$$;

-- 3. Ensure everyone can call these RPCs
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

-- 4. Fix potential recursion in has_role by making it simpler
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Final check on table grants for auth flow
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT ON public.permissions TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
