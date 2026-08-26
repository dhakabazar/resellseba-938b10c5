create or replace function public.admin_set_phone_verified(_user_id uuid, _verified boolean default true)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  _ts timestamptz;
begin
  perform public.assert_admin_permission(array['resellers.manage','users.manage']);
  _ts := case when _verified then now() else null end;
  update public.profiles set phone_verified_at = _ts, updated_at = now() where id = _user_id;
  if not found then
    raise exception 'Profile not found';
  end if;
  return _ts;
end;
$$;

revoke all on function public.admin_set_phone_verified(uuid, boolean) from public;
grant execute on function public.admin_set_phone_verified(uuid, boolean) to authenticated;