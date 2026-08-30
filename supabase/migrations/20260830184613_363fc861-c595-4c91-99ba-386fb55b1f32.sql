create or replace function public.active_courier_providers()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin(auth.uid())
      or public.has_permission(auth.uid(), 'couriers.manage')
      or public.has_permission(auth.uid(), 'orders.ship')
      or public.has_permission(auth.uid(), 'orders.status')
      or public.has_permission(auth.uid(), 'orders.edit')
    then (
      select coalesce(array_agg(c.provider::text order by c.provider::text), array[]::text[])
      from public.courier_configs c
      where c.is_active
    )
    else array[]::text[]
  end;
$$;

revoke all on function public.active_courier_providers() from public;
grant execute on function public.active_courier_providers() to authenticated;
grant execute on function public.active_courier_providers() to service_role;