create or replace function public.panel_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r record;
  res jsonb;
begin
  if uid is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select * into r from resellers where user_id = uid limit 1;

  res := jsonb_build_object(
    'signed_in', true,
    'settings', (select to_jsonb(g) from global_settings g where g.id = 1),
    'roles', (select coalesce(jsonb_agg(ur.role), '[]'::jsonb) from user_roles ur where ur.user_id = uid),
    'permissions', to_jsonb(public.my_permissions()),
    'verify', (select to_jsonb(v) from public.verify_state() v),
    'reseller', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'code', r.code, 'business_name', r.business_name, 'status', r.status,
      'avatar_url', r.avatar_url, 'deposit_required', r.deposit_required,
      'deposit_required_amount', r.deposit_required_amount, 'frozen_amount', r.frozen_amount
    ) end,
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
$$;

revoke execute on function public.panel_bootstrap() from public, anon;
grant execute on function public.panel_bootstrap() to authenticated;