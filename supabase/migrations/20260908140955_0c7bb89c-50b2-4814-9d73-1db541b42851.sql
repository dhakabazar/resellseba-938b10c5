-- Reseller staff: sub-accounts a reseller creates for their own panel, each
-- with a simple per-menu permission list.
create table if not exists public.reseller_staff (
  id uuid primary key default gen_random_uuid(),
  reseller_id uuid not null references public.resellers(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  permissions text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reseller_staff_reseller_idx on public.reseller_staff(reseller_id);

grant select on public.reseller_staff to authenticated;
grant all on public.reseller_staff to service_role;

alter table public.reseller_staff enable row level security;

drop policy if exists "reseller_staff: owner reads" on public.reseller_staff;
create policy "reseller_staff: owner reads" on public.reseller_staff
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.resellers r where r.id = reseller_staff.reseller_id and r.user_id = auth.uid())
    or public.is_super_admin(auth.uid())
  );

-- Staff of an active reseller resolve to that reseller everywhere RLS uses
-- current_reseller_id(); owners keep priority.
create or replace function public.current_reseller_id()
returns uuid
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select id from public.resellers where user_id = auth.uid() limit 1),
    (select reseller_id from public.reseller_staff where user_id = auth.uid() and active limit 1)
  );
$$;

create or replace function public.is_reseller_owner()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.resellers where user_id = auth.uid());
$$;

-- Policies that compared resellers.user_id directly now also accept staff.
drop policy if exists "Resellers: read own" on public.resellers;
create policy "Resellers: read own" on public.resellers
  for select to authenticated
  using (user_id = auth.uid() or id = public.current_reseller_id());

drop policy if exists "Resellers: update own limited" on public.resellers;
create policy "Resellers: update own limited" on public.resellers
  for update to authenticated
  using (user_id = auth.uid() or id = public.current_reseller_id())
  with check (user_id = auth.uid() or id = public.current_reseller_id());

drop policy if exists "Resellers can view own order courier events" on public.courier_events;
create policy "Resellers can view own order courier events" on public.courier_events
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = courier_events.order_id and o.reseller_id = public.current_reseller_id()));

-- Bootstrap: resolve the reseller through current_reseller_id() and expose the
-- staff membership (permissions) so the panel can gate its menus.
create or replace function public.panel_bootstrap()
returns jsonb
language plpgsql stable security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  r record;
  st record;
  res jsonb;
begin
  if uid is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select * into st from reseller_staff where user_id = uid limit 1;
  if st.id is not null and not st.active then
    select * into r from resellers where false;
  else
    select * into r from resellers where id = public.current_reseller_id() limit 1;
  end if;

  res := jsonb_build_object(
    'signed_in', true,
    'settings', (select to_jsonb(g) from global_settings g where g.id = 1),
    'roles', (select coalesce(jsonb_agg(ur.role), '[]'::jsonb) from user_roles ur where ur.user_id = uid),
    'permissions', to_jsonb(public.my_permissions()),
    'verify', (select to_jsonb(v) from public.verify_state() v),
    'reseller_staff', case when st.id is null then null else jsonb_build_object(
      'id', st.id, 'reseller_id', st.reseller_id, 'full_name', st.full_name,
      'permissions', to_jsonb(st.permissions), 'active', st.active
    ) end,
    'reseller', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'code', r.code, 'business_name', r.business_name, 'status', r.status,
      'avatar_url', r.avatar_url, 'deposit_required', r.deposit_required,
      'deposit_required_amount', r.deposit_required_amount, 'frozen_amount', r.frozen_amount,
      'subscription_plan', r.subscription_plan,
      'subscription_expires_at', r.subscription_expires_at,
      'subscription_trial_ends_at', r.subscription_trial_ends_at,
      'subscription_exempt', r.subscription_exempt
    ) end,
    'subscription', case when r.id is null then null else public.subscription_state(r.id) end,
    'reseller_settings', case when r.id is null then null else
      (select jsonb_build_object('logo_url', s.logo_url, 'primary_color', s.primary_color)
       from reseller_settings s where s.reseller_id = r.id) end,
    'deposits', case when r.id is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object(
          'id', d.id, 'amount', d.amount, 'method', d.method,
          'reference', d.reference, 'note', d.note, 'created_at', d.created_at
        ) order by d.created_at desc), '[]'::jsonb)
       from reseller_deposits d where d.reseller_id = r.id) end,
    'notices', (
      select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc), '[]'::jsonb)
      from admin_notices n
      where n.is_active
        and (n.starts_at is null or n.starts_at <= now())
        and (n.ends_at is null or n.ends_at >= now())
        and (coalesce(array_length(n.target_reseller_ids, 1), 0) = 0
             or (r.id is not null and r.id = any (n.target_reseller_ids)))
        and not exists (
          select 1 from admin_notice_dismissals d
          where d.notice_id = n.id and d.user_id = uid
        )
    )
  );

  return res;
end;
$function$;

-- Owner-only management RPCs -------------------------------------------------
create or replace function public.reseller_staff_owner_id()
returns uuid
language plpgsql stable security definer
set search_path to 'public'
as $$
declare v uuid;
begin
  select id into v from public.resellers where user_id = auth.uid() and status = 'active' limit 1;
  if v is null then
    raise exception 'Only the reseller owner can manage staff';
  end if;
  return v;
end;
$$;

create or replace function public.reseller_staff_list()
returns table(id uuid, user_id uuid, email text, full_name text, permissions text[], active boolean, created_at timestamptz)
language sql stable security definer
set search_path to 'public'
as $$
  select s.id, s.user_id, u.email::text, s.full_name, s.permissions, s.active, s.created_at
  from public.reseller_staff s
  join auth.users u on u.id = s.user_id
  where s.reseller_id = public.reseller_staff_owner_id()
  order by s.created_at desc;
$$;

create or replace function public.reseller_staff_create(_email text, _password text, _full_name text, _permissions text[])
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_rid uuid := public.reseller_staff_owner_id();
  v_id uuid := gen_random_uuid();
  v_email text := lower(trim(_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;
  if _password is null or length(_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'This email is already registered';
  end if;
  if (select count(*) from public.reseller_staff where reseller_id = v_rid) >= 20 then
    raise exception 'Staff limit reached (20)';
  end if;

  -- is_staff=true stops the signup trigger from opening a new reseller account.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(_full_name,''), 'is_staff', 'true', 'reseller_staff', 'true'),
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

  insert into public.profiles (id, full_name) values (v_id, coalesce(_full_name,''))
  on conflict (id) do update set full_name = excluded.full_name;

  delete from public.user_roles where user_id = v_id;
  insert into public.user_roles (user_id, role) values (v_id, 'reseller');

  insert into public.reseller_staff (reseller_id, user_id, full_name, permissions)
  values (v_rid, v_id, _full_name, coalesce(_permissions, '{}'));

  return v_id;
end;
$function$;

create or replace function public.reseller_staff_update(_id uuid, _full_name text, _permissions text[], _active boolean, _password text)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_rid uuid := public.reseller_staff_owner_id();
  v_uid uuid;
begin
  select user_id into v_uid from public.reseller_staff where id = _id and reseller_id = v_rid;
  if v_uid is null then
    raise exception 'Staff not found';
  end if;
  update public.reseller_staff
     set full_name = coalesce(_full_name, full_name),
         permissions = coalesce(_permissions, permissions),
         active = coalesce(_active, active),
         updated_at = now()
   where id = _id;
  if _full_name is not null then
    update public.profiles set full_name = _full_name where id = v_uid;
  end if;
  if _password is not null and _password <> '' then
    if length(_password) < 6 then
      raise exception 'Password must be at least 6 characters';
    end if;
    update auth.users
       set encrypted_password = extensions.crypt(_password, extensions.gen_salt('bf')),
           updated_at = now()
     where id = v_uid;
  end if;
end;
$function$;

create or replace function public.reseller_staff_delete(_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare
  v_rid uuid := public.reseller_staff_owner_id();
  v_uid uuid;
begin
  select user_id into v_uid from public.reseller_staff where id = _id and reseller_id = v_rid;
  if v_uid is null then
    raise exception 'Staff not found';
  end if;
  delete from auth.users where id = v_uid;
end;
$function$;

grant execute on function public.reseller_staff_list() to authenticated;
grant execute on function public.reseller_staff_create(text, text, text, text[]) to authenticated;
grant execute on function public.reseller_staff_update(uuid, text, text[], boolean, text) to authenticated;
grant execute on function public.reseller_staff_delete(uuid) to authenticated;
grant execute on function public.is_reseller_owner() to authenticated;
revoke execute on function public.reseller_staff_owner_id() from public;