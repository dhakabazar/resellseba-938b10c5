CREATE OR REPLACE FUNCTION public.pick_balanced_agent()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH day_start AS (
    SELECT (date_trunc('day', (now() AT TIME ZONE 'Asia/Dhaka')) AT TIME ZONE 'Asia/Dhaka') AS ts
  )
  SELECT a.id
  FROM public.agents a
  WHERE a.is_active
    AND NOT public.has_role(a.user_id, 'super_admin')
    AND public.has_any_permission(a.user_id, ARRAY[
      'resellers.manage','resellers.view_all','resellers.view_own',
      'resellers.view','resellers.edit'
    ])
  ORDER BY
    (SELECT count(*) FROM public.resellers r, day_start d
       WHERE r.agent_id = a.id AND r.created_at >= d.ts) ASC,
    (SELECT max(r.created_at) FROM public.resellers r, day_start d
       WHERE r.agent_id = a.id AND r.created_at >= d.ts) ASC NULLS FIRST,
    a.created_at ASC,
    a.id ASC
  LIMIT 1;
$function$;