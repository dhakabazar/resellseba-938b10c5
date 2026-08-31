CREATE OR REPLACE FUNCTION public.reseller_auto_assign()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT (advanced_settings->>'resellerAutoAssign')::boolean
       FROM public.global_settings WHERE id = 1),
    false);
$$;

CREATE OR REPLACE FUNCTION public.pick_balanced_agent()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id
  FROM public.agents a
  WHERE a.is_active
    AND public.has_any_permission(a.user_id, ARRAY[
      'resellers.manage','resellers.view_all','resellers.view_own',
      'resellers.view','resellers.edit'
    ])
  ORDER BY (SELECT count(*) FROM public.resellers r WHERE r.agent_id = a.id) ASC,
           a.created_at ASC,
           a.id ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.reseller_auto_assign_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.agent_id IS NULL AND public.reseller_auto_assign() THEN
    NEW.agent_id := public.pick_balanced_agent();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS reseller_auto_assign_before_insert ON public.resellers;
CREATE TRIGGER reseller_auto_assign_before_insert
BEFORE INSERT ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.reseller_auto_assign_on_insert();