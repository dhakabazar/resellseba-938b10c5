DROP POLICY IF EXISTS "Staff read resellers by permission" ON public.resellers;

CREATE POLICY "Staff read resellers by permission"
ON public.resellers
FOR SELECT
USING (
  has_any_permission(auth.uid(), ARRAY['resellers.manage','resellers.view','resellers.view_all','resellers.create','resellers.edit','resellers.delete','resellers.verify','resellers.deposit','resellers.password','resellers.impersonate','orders.view','orders.create','orders.edit','dashboard.view','finance.view','reports.view','payouts.manage','commissions.manage'])
  AND (
    NOT has_permission(auth.uid(), 'resellers.view_own')
    OR has_any_permission(auth.uid(), ARRAY['resellers.manage','resellers.view_all'])
    OR (agent_id IS NOT NULL AND agent_id = current_agent_id())
  )
);