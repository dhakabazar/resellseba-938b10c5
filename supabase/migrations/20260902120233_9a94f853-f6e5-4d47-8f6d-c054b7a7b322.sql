create or replace function public.subscription_request_set_amount()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.plan not in ('panel','panel_store') then
    raise exception 'Unknown monthly package';
  end if;
  if new.months not in (1,6,12) then
    raise exception 'Unknown package duration';
  end if;
  new.amount := public.subscription_price(new.reseller_id, new.plan, new.months);
  if coalesce(new.amount, 0) <= 0 then
    raise exception 'This package has no price yet';
  end if;
  return new;
end
$$;

drop trigger if exists trg_subscription_request_amount on public.subscription_requests;
create trigger trg_subscription_request_amount
before insert on public.subscription_requests
for each row execute function public.subscription_request_set_amount();