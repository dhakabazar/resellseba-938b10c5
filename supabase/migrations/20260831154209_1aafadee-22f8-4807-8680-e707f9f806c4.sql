create or replace function public.admin_create_staff_user(
  _email text,
  _password text,
  _full_name text,
  _role app_role,
  _custom_role_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(_email));
begin
  perform public.assert_admin_permission(array['staff.manage']);
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;
  if _password is null or length(_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'This email is already registered';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(_full_name,''), 'is_staff', 'true'),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, provider, identity_data, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    now(), now()
  );

  delete from public.user_roles where user_id = v_id;
  insert into public.user_roles (user_id, role, custom_role_id)
  values (v_id, _role, _custom_role_id);

  delete from public.resellers where user_id = v_id;

  return v_id;
end;
$$;

-- Repair accounts already created with NULL token columns (GoTrue cannot sign them in).
update auth.users
set confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, ''),
    email_change_token_current = coalesce(email_change_token_current, ''),
    phone_change = coalesce(phone_change, ''),
    phone_change_token = coalesce(phone_change_token, ''),
    reauthentication_token = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change is null
   or email_change_token_current is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;