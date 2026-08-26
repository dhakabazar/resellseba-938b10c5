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
  perform public.assert_admin_permission(array['staff.manage','resellers.manage']);
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

CREATE OR REPLACE FUNCTION public.verify_state()
 RETURNS TABLE(email_verified_at timestamp with time zone, phone_verified_at timestamp with time zone, email_sent_at timestamp with time zone, sms_sent_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(p.email_verified_at, u.email_confirmed_at), p.phone_verified_at,
    (SELECT c.created_at FROM public.verification_codes c WHERE c.user_id = p.id AND c.channel = 'email'),
    (SELECT c.created_at FROM public.verification_codes c WHERE c.user_id = p.id AND c.channel = 'sms')
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = auth.uid()
$function$;