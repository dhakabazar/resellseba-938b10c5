-- Helper: caller must hold one of the given permissions (or be super admin)
create or replace function public.assert_admin_permission(_permissions text[])
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if public.is_super_admin(auth.uid()) then
    return;
  end if;
  if public.has_any_permission(auth.uid(), _permissions) then
    return;
  end if;
  raise exception 'Forbidden';
end;
$$;

-- Emails + confirmation status (auth schema is readable only through this guard)
create or replace function public.admin_auth_users()
returns table(user_id uuid, email text, email_confirmed boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission(array['staff.manage','resellers.manage']);
  return query
    select u.id, u.email::text, (u.email_confirmed_at is not null), u.created_at
    from auth.users u;
end;
$$;

create or replace function public.admin_confirm_user_email(_user_id uuid)
returns table(email text, already_confirmed boolean)
language plpgsql
security definer
set search_path = public
as $$
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
  if v_confirmed is not null then
    return query select v_email, true;
    return;
  end if;
  update auth.users set email_confirmed_at = now(), updated_at = now() where id = _user_id;
  return query select v_email, false;
end;
$$;

create or replace function public.admin_set_user_password(_user_id uuid, _password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission(array['staff.manage','resellers.manage']);
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
$$;

create or replace function public.admin_assign_role(_user_id uuid, _role app_role, _custom_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission(array['staff.manage']);
  delete from public.user_roles where user_id = _user_id;
  insert into public.user_roles (user_id, role, custom_role_id)
  values (_user_id, _role, _custom_role_id);
end;
$$;

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
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(_full_name,''), 'is_staff', 'true'),
    now(), now()
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

create or replace function public.admin_delete_user(_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission(array['staff.manage','resellers.manage']);
  if _user_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;
  if exists (select 1 from public.user_roles r where r.user_id = _user_id and r.role = 'super_admin')
     and not public.is_super_admin(auth.uid()) then
    raise exception 'Only a super admin can delete a super admin account';
  end if;
  delete from auth.users where id = _user_id;
end;
$$;

revoke all on function public.assert_admin_permission(text[]) from public, anon;
revoke all on function public.admin_auth_users() from public, anon;
revoke all on function public.admin_confirm_user_email(uuid) from public, anon;
revoke all on function public.admin_set_user_password(uuid, text) from public, anon;
revoke all on function public.admin_assign_role(uuid, app_role, uuid) from public, anon;
revoke all on function public.admin_create_staff_user(text, text, text, app_role, uuid) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;

grant execute on function public.admin_auth_users() to authenticated;
grant execute on function public.admin_confirm_user_email(uuid) to authenticated;
grant execute on function public.admin_set_user_password(uuid, text) to authenticated;
grant execute on function public.admin_assign_role(uuid, app_role, uuid) to authenticated;
grant execute on function public.admin_create_staff_user(text, text, text, app_role, uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
