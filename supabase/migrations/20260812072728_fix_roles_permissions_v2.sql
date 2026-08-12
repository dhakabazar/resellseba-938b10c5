-- Ensure correct grants for all relevant tables
GRANT ALL ON public.roles TO authenticated;
GRANT ALL ON public.role_permissions TO authenticated;
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.permissions TO authenticated;

GRANT ALL ON public.roles TO service_role;
GRANT ALL ON public.role_permissions TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.permissions TO service_role;

-- Fix RLS policies for Roles
DROP POLICY IF EXISTS "Super admins can manage roles" ON public.roles;
CREATE POLICY "Super admins can manage roles" ON public.roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users can view roles" ON public.roles;
CREATE POLICY "Users can view roles" ON public.roles
FOR SELECT TO authenticated
USING (true);

-- Fix RLS policies for Role Permissions
DROP POLICY IF EXISTS "Super admins can manage role_permissions" ON public.role_permissions;
CREATE POLICY "Super admins can manage role_permissions" ON public.role_permissions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS "Users can view role_permissions" ON public.role_permissions;
CREATE POLICY "Users can view role_permissions" ON public.role_permissions
FOR SELECT TO authenticated
USING (true);

-- Fix RLS policies for User Roles (needed for role assignment)
DROP POLICY IF EXISTS "Super admins can manage user_roles" ON public.user_roles;
CREATE POLICY "Super admins can manage user_roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));

-- Ensure has_role function is correct and security definer
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
