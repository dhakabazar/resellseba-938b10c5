INSERT INTO public.permissions (name, label, description, group_key, group_label, sort_order)
VALUES
  ('resellers.view_all', 'See all resellers (agent filter)', 'View every reseller in the list and filter by agent', 'resellers', 'Resellers', 78),
  ('resellers.view_own', 'See only assigned resellers', 'View only the resellers assigned to this staff member as agent', 'resellers', 'Resellers', 79)
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, group_key = EXCLUDED.group_key, group_label = EXCLUDED.group_label, sort_order = EXCLUDED.sort_order;

DROP POLICY IF EXISTS "Staff read resellers by permission" ON public.resellers;
CREATE POLICY "Staff read resellers by permission" ON public.resellers
FOR SELECT TO authenticated
USING (has_any_permission(auth.uid(), ARRAY[
  'resellers.manage','resellers.view','resellers.view_all','resellers.create','resellers.edit','resellers.delete',
  'resellers.verify','resellers.deposit','resellers.password','resellers.impersonate',
  'orders.view','orders.create','orders.edit','dashboard.view','finance.view','reports.view',
  'payouts.manage','commissions.manage'
]));