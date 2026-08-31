CREATE OR REPLACE FUNCTION public.admin_impersonation_login(_user_id uuid, _password text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_status reseller_status;
begin
  perform public.assert_admin_permission(array['resellers.manage','resellers.impersonate']);

  if _password is null or length(_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  select r.status into v_status from public.resellers r where r.user_id = _user_id;
  if v_status is null then
    raise exception 'Reseller profile not found';
  end if;
  if v_status <> 'active' then
    raise exception 'Only active resellers can be opened';
  end if;

  select u.email::text into v_email from auth.users u where u.id = _user_id;
  if v_email is null or v_email = '' then
    raise exception 'Reseller account has no email';
  end if;

  insert into public.user_roles (user_id, role)
  values (_user_id, 'reseller')
  on conflict (user_id, role) do nothing;

  update auth.users
     set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = coalesce(confirmation_token, ''),
         recovery_token = coalesce(recovery_token, ''),
         email_change_token_new = coalesce(email_change_token_new, ''),
         email_change_token_current = coalesce(email_change_token_current, ''),
         email_change = coalesce(email_change, ''),
         phone_change = coalesce(phone_change, ''),
         phone_change_token = coalesce(phone_change_token, ''),
         reauthentication_token = coalesce(reauthentication_token, ''),
         updated_at = now()
   where id = _user_id;

  update public.profiles p
     set email_verified_at = coalesce(p.email_verified_at, now()), updated_at = now()
   where p.id = _user_id;

  return query select v_email;
end;
$function$;

REVOKE ALL ON FUNCTION public.admin_impersonation_login(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_impersonation_login(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_impersonation_login(uuid, text) TO service_role;