-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;

-- Create more robust policies using has_role function
CREATE POLICY "Super admins can manage roles"
ON public.roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can manage role_permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Ensure SELECT is allowed for all authenticated users if they need to see roles
-- (e.g. for user assignment)
CREATE POLICY "Users can view roles"
ON public.roles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can view role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);
