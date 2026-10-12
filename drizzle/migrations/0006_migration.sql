create or replace function public.admin_order_status_counts(
  _from_ts bigint default null, _to_ts bigint default null,
  _reseller_id uuid default null, _area text default null, _courier text default null,
  _q text default null, _search_mode text default 'customer')
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare v jsonb; q text := nullif(lower(trim(coalesce(_q,''))),'');
begin
  if not public.has_any_permission(auth.uid(), '{orders.view,orders.edit,orders.create,orders.delete,orders.status,orders.ship}'::text[]) then
    raise exception 'not authorized';
  end if;
  select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) into v from (
    select o.status::text as status, count(*) c from orders o
    where (_from_ts is null or (extract(epoch from o.created_at)*1000)::bigint >= _from_ts)
      and (_to_ts is null or (extract(epoch from o.created_at)*1000)::bigint <= _to_ts)
      and (_reseller_id is null or o.reseller_id = _reseller_id)
      and (nullif(_area,'') is null or o.area = _area)
      and (nullif(_courier,'') is null
           or (_courier = 'none' and not exists (select 1 from shipments s where s.order_id=o.id and s.provider is not null))
           or (_courier <> 'none' and exists (select 1 from shipments s where s.order_id=o.id and s.provider::text=_courier)))
      and (q is null
           or (_search_mode = 'product' and exists (select 1 from order_items i where i.order_id=o.id and lower(i.product_name) like '%'||q||'%'))
           or (_search_mode <> 'product' and (lower(coalesce(o.order_number::text,'')) like '%'||q||'%' or lower(coalesce(o.customer_name,'')) like '%'||q||'%' or lower(coalesce(o.customer_phone,'')) like '%'||q||'%')))
    group by 1) t;
  return v;
end $$;
revoke all on function public.admin_order_status_counts(bigint,bigint,uuid,text,text,text,text) from public, anon;
grant execute on function public.admin_order_status_counts(bigint,bigint,uuid,text,text,text,text) to authenticated;