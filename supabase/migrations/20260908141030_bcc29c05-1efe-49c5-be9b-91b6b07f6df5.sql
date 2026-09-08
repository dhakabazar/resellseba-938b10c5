revoke execute on function public.reseller_staff_list() from anon, public;
revoke execute on function public.reseller_staff_create(text, text, text, text[]) from anon, public;
revoke execute on function public.reseller_staff_update(uuid, text, text[], boolean, text) from anon, public;
revoke execute on function public.reseller_staff_delete(uuid) from anon, public;
revoke execute on function public.is_reseller_owner() from anon, public;