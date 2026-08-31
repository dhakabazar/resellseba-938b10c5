CREATE OR REPLACE FUNCTION public.protect_reseller_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_promote boolean := false;
  v_uid uuid := auth.uid();
  v_full boolean;
  v_edit boolean;
  v_deposit boolean;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'pending' AND public.reseller_auto_approve() THEN
    NEW.status := 'active';
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    v_promote := true;
  END IF;

  v_full := v_uid IS NULL
            OR public.is_super_admin(v_uid)
            OR public.has_permission(v_uid, 'resellers.manage');

  IF v_full THEN
    RETURN NEW;
  END IF;

  v_edit := public.has_permission(v_uid, 'resellers.edit');
  v_deposit := public.has_permission(v_uid, 'resellers.deposit');

  -- Status / approval: allowed for staff who may edit resellers.
  IF NOT v_promote AND NOT v_edit
     AND (NEW.status IS DISTINCT FROM OLD.status
          OR NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    RAISE EXCEPTION 'Not allowed to change reseller status';
  END IF;

  -- Internal notes: allowed for staff who may edit resellers.
  IF NOT v_edit AND NEW.notes IS DISTINCT FROM OLD.notes THEN
    RAISE EXCEPTION 'Not allowed to change reseller notes';
  END IF;

  -- Deposit rule fields: allowed for staff with the deposit permission.
  IF NOT v_deposit
     AND (NEW.deposit_required IS DISTINCT FROM OLD.deposit_required
          OR NEW.deposit_required_amount IS DISTINCT FROM OLD.deposit_required_amount
          OR NEW.frozen_amount IS DISTINCT FROM OLD.frozen_amount) THEN
    RAISE EXCEPTION 'Not allowed to change reseller deposit settings';
  END IF;

  -- Commercial / identity fields stay reserved for full reseller managers.
  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.leader_id IS DISTINCT FROM OLD.leader_id
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to modify admin-controlled reseller fields';
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.admin_auth_users()
 RETURNS TABLE(user_id uuid, email text, email_confirmed boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin_permission(array[
    'staff.manage','resellers.manage','resellers.view','resellers.view_all',
    'resellers.edit','resellers.verify','resellers.password','resellers.impersonate'
  ]);
  return query
    select u.id, u.email::text, (u.email_confirmed_at is not null), u.created_at
    from auth.users u;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_confirm_user_email(_user_id uuid)
 RETURNS TABLE(email text, already_confirmed boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_confirmed timestamptz;
begin
  perform public.assert_admin_permission(array[
    'staff.manage','resellers.manage','resellers.verify','resellers.impersonate'
  ]);
  select u.email::text, u.email_confirmed_at into v_email, v_confirmed
  from auth.users u where u.id = _user_id;
  if v_email is null then
    raise exception 'User not found';
  end if;

  update public.profiles p
     set email_verified_at = coalesce(p.email_verified_at, now()), updated_at = now()
   where p.id = _user_id;

  if v_confirmed is not null then
    return query select v_email, true;
    return;
  end if;
  update auth.users set email_confirmed_at = now(), updated_at = now() where id = _user_id;
  return query select v_email, false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_password(_user_id uuid, _password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.assert_admin_permission(array[
    'staff.manage','resellers.manage','resellers.password','resellers.impersonate'
  ]);
  if _password is null or length(_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
         updated_at = now()
   where id = _user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$function$;