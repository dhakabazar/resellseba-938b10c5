CREATE OR REPLACE FUNCTION public.reseller_auto_approve()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (advanced_settings->>'resellerAutoApprove')::boolean
       FROM public.global_settings WHERE id = 1),
    false);
$$;

CREATE OR REPLACE FUNCTION public.reseller_auto_approve_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND public.reseller_auto_approve() THEN
    NEW.status := 'active';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_reseller_auto_approve ON public.resellers;
CREATE TRIGGER trg_reseller_auto_approve
BEFORE INSERT ON public.resellers
FOR EACH ROW EXECUTE FUNCTION public.reseller_auto_approve_on_insert();

CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promote boolean := false;
BEGIN
  -- Auto approval: a still-pending application flips to active by itself when
  -- the platform switch is on. Admins keep full manual control otherwise.
  IF OLD.status = 'pending' AND NEW.status = 'pending' AND public.reseller_auto_approve() THEN
    NEW.status := 'active';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    v_promote := true;
  END IF;

  IF auth.uid() IS NULL
     OR public.is_super_admin(auth.uid())
     OR public.has_permission(auth.uid(), 'resellers.manage') THEN
    RETURN NEW;
  END IF;

  IF (NOT v_promote AND (NEW.status IS DISTINCT FROM OLD.status
                         OR NEW.approved_at IS DISTINCT FROM OLD.approved_at))
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.deposit_required IS DISTINCT FROM OLD.deposit_required
     OR NEW.deposit_required_amount IS DISTINCT FROM OLD.deposit_required_amount
     OR NEW.frozen_amount IS DISTINCT FROM OLD.frozen_amount
     OR NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;

  RETURN NEW;
END
$$;

GRANT EXECUTE ON FUNCTION public.reseller_auto_approve() TO authenticated, anon;