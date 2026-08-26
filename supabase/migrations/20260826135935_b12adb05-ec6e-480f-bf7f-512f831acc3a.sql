create or replace function public.reseller_sync_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'active' then
    insert into public.user_roles (user_id, role)
    values (NEW.user_id, 'reseller')
    on conflict (user_id, role) do nothing;

    insert into public.reseller_settings (reseller_id, store_name)
    values (NEW.id, coalesce(nullif(trim(NEW.business_name), ''), 'My store'))
    on conflict (reseller_id) do nothing;
  else
    delete from public.user_roles
     where user_id = NEW.user_id and role = 'reseller';
  end if;
  return null;
end
$$;

drop trigger if exists reseller_sync_role_ins on public.resellers;
drop trigger if exists reseller_sync_role_upd on public.resellers;

create trigger reseller_sync_role_ins
after insert on public.resellers
for each row execute function public.reseller_sync_role();

create trigger reseller_sync_role_upd
after update of status on public.resellers
for each row when (NEW.status is distinct from OLD.status)
execute function public.reseller_sync_role();

-- Heal existing rows so status and panel access agree everywhere.
insert into public.user_roles (user_id, role)
select r.user_id, 'reseller'::app_role from public.resellers r where r.status = 'active'
on conflict (user_id, role) do nothing;

delete from public.user_roles ur
 where ur.role = 'reseller'
   and exists (select 1 from public.resellers r where r.user_id = ur.user_id and r.status <> 'active');