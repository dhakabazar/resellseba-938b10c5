DROP POLICY IF EXISTS "Staff manage roles by permission" ON public.roles;
CREATE POLICY "Staff manage roles by permission" ON public.roles
FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'staff.manage'));

DROP POLICY IF EXISTS "Staff manage role_permissions by permission" ON public.role_permissions;
CREATE POLICY "Staff manage role_permissions by permission" ON public.role_permissions
FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'))
WITH CHECK (public.has_permission(auth.uid(), 'staff.manage'));

DROP POLICY IF EXISTS "Staff read profiles for staff management" ON public.profiles;
CREATE POLICY "Staff read profiles for staff management" ON public.profiles
FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), 'staff.manage'));