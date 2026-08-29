create or replace function public.admin_update_user(
  _user_id uuid,
  _email text default null,
  _full_name text default null,
  _phone text default null,
  _role app_role default null,
  _custom_role_id uuid default null,
  _password text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := lower(trim(coalesce(_email, '')));
begin
  perform public.assert_admin_permission(array['staff.manage']);

  if not exists (select 1 from auth.users where id = _user_id) then
    raise exception 'User not found';
  end if;

  if v_email <> '' then
    if exists (select 1 from auth.users u where lower(u.email) = v_email and u.id <> _user_id) then
      raise exception 'This email is already registered';
    end if;
    update auth.users
       set email = v_email,
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = _user_id;
    update auth.identities
       set identity_data = identity_data || jsonb_build_object('email', v_email),
           updated_at = now()
     where user_id = _user_id and provider = 'email';
  end if;

  if _password is not null and _password <> '' then
    if length(_password) < 6 then
      raise exception 'Password must be at least 6 characters';
    end if;
    update auth.users
       set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
           updated_at = now()
     where id = _user_id;
  end if;

  if _full_name is not null then
    update auth.users
       set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('full_name', _full_name),
           updated_at = now()
     where id = _user_id;
  end if;

  insert into public.profiles (id, full_name, phone)
  values (_user_id, _full_name, _phone)
  on conflict (id) do update
    set full_name = coalesce(_full_name, public.profiles.full_name),
        phone = coalesce(_phone, public.profiles.phone),
        updated_at = now();

  if _role is not null then
    delete from public.user_roles where user_id = _user_id;
    insert into public.user_roles (user_id, role, custom_role_id)
    values (_user_id, _role, _custom_role_id);
  end if;
end;
$function$;

revoke all on function public.admin_update_user(uuid, text, text, text, app_role, uuid, text) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, text, app_role, uuid, text) to authenticated;