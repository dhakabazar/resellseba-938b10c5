CREATE OR REPLACE FUNCTION public.admin_order_status_counts(_from_ts bigint DEFAULT NULL::bigint, _to_ts bigint DEFAULT NULL::bigint, _reseller_id uuid DEFAULT NULL::uuid, _area text DEFAULT NULL::text, _courier text DEFAULT NULL::text, _q text DEFAULT NULL::text, _search_mode text DEFAULT 'customer'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; q text := nullif(lower(trim(coalesce(_q,''))),'');
begin
  if not public.has_any_permission(auth.uid(), '{orders.view,orders.edit,orders.create,orders.delete,orders.status,orders.ship}'::text[]) then
    raise exception 'not authorized';
  end if;
  select coalesce(jsonb_object_agg(status, c), '{}'::jsonb) into v from (
    select o.status::text as status, count(*) c from orders o
    where (_from_ts is null or o.created_at >= to_timestamp(_from_ts / 1000.0))
      and (_to_ts is null or o.created_at <= to_timestamp(_to_ts / 1000.0))
      and (_reseller_id is null or o.reseller_id = _reseller_id)
      and (nullif(_area,'') is null or o.area::text = _area)
      and (nullif(_courier,'') is null
           or (_courier = 'none' and not exists (select 1 from shipments s where s.order_id=o.id and s.provider is not null))
           or (_courier <> 'none' and exists (select 1 from shipments s where s.order_id=o.id and s.provider::text=_courier)))
      and (q is null
           or (_search_mode = 'product' and exists (select 1 from order_items i where i.order_id=o.id and lower(i.product_name) like '%'||q||'%'))
           or (_search_mode <> 'product' and (lower(coalesce(o.order_number::text,'')) like '%'||q||'%' or lower(coalesce(o.customer_name,'')) like '%'||q||'%' or lower(coalesce(o.customer_phone,'')) like '%'||q||'%')))
    group by 1) t;
  return v;
end $function$;
GRANT EXECUTE ON FUNCTION public.admin_order_status_counts(bigint,bigint,uuid,text,text,text,text) TO authenticated;