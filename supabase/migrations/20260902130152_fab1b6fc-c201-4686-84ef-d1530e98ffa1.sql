CREATE OR REPLACE FUNCTION public.subscription_applies(_reseller_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; v_master boolean;
BEGIN
  IF _reseller_id IS NULL THEN RETURN false; END IF;
  SELECT subscription_enrolled, subscription_exempt INTO r FROM public.resellers WHERE id = _reseller_id;
  IF r IS NULL THEN RETURN false; END IF;
  -- per-reseller OFF always wins
  IF COALESCE(r.subscription_exempt, false) THEN RETURN false; END IF;
  -- per-reseller ON works even when the master switch is off
  IF COALESCE(r.subscription_enrolled, false) THEN RETURN true; END IF;
  v_master := COALESCE((public.subscription_config()->>'enabled')::boolean, false);
  RETURN v_master AND public.subscription_auto_apply();
END $function$;