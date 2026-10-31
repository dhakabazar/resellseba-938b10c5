-- JSON wrappers: a set-returning RPC is capped at 1000 rows by the Data API;
-- a single jsonb value is not. SECURITY INVOKER keeps each inner function's own checks.
CREATE OR REPLACE FUNCTION public.transaction_report_all(_reseller_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'ord' ORDER BY t.ord), '[]'::jsonb)
  FROM public.transaction_report(_reseller_id, _from, _to, _limit) WITH ORDINALITY AS t(at,kind,direction,reseller_id,reseller_name,reseller_code,order_id,order_number,status,label,note,sell_subtotal,sell_delivery,sell_total,buy_product,buy_delivery,packaging,buy_total,collected,received,advance,advance_by,amount,running,ord);
$$;

CREATE OR REPLACE FUNCTION public.admin_reseller_metrics_all()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) FROM public.admin_reseller_metrics() m; $$;

CREATE OR REPLACE FUNCTION public.admin_auth_users_all()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) FROM public.admin_auth_users() u; $$;

CREATE OR REPLACE FUNCTION public.reseller_ledger_all(_reseller_id uuid, _limit integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'ord' ORDER BY t.ord), '[]'::jsonb)
  FROM public.reseller_ledger(_reseller_id, _limit) WITH ORDINALITY AS t(at,kind,direction,label,reference,status,amount,running,ord);
$$;

CREATE OR REPLACE FUNCTION public.reseller_custom_rate_summary_all()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$ SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.reseller_custom_rate_summary() s; $$;

REVOKE ALL ON FUNCTION public.transaction_report_all(uuid,timestamptz,timestamptz,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reseller_metrics_all() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_auth_users_all() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reseller_ledger_all(uuid,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reseller_custom_rate_summary_all() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transaction_report_all(uuid,timestamptz,timestamptz,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reseller_metrics_all() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_auth_users_all() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_ledger_all(uuid,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reseller_custom_rate_summary_all() TO authenticated, service_role;