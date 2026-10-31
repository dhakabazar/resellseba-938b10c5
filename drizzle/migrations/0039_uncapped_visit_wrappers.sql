CREATE OR REPLACE FUNCTION public.store_visit_leaderboard_all(_from timestamptz, _to timestamptz, _limit integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'ord' ORDER BY t.ord), '[]'::jsonb)
  FROM public.store_visit_leaderboard(_from, _to, _limit) WITH ORDINALITY AS t(reseller_id,code,business_name,visits,visitors,live,last_at,ord);
$$;
CREATE OR REPLACE FUNCTION public.store_visit_pages_all(_reseller_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'ord' ORDER BY t.ord), '[]'::jsonb)
  FROM public.store_visit_pages(_reseller_id, _from, _to, _limit) WITH ORDINALITY AS t(path,visits,visitors,ord);
$$;
REVOKE ALL ON FUNCTION public.store_visit_leaderboard_all(timestamptz,timestamptz,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.store_visit_pages_all(uuid,timestamptz,timestamptz,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_visit_leaderboard_all(timestamptz,timestamptz,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.store_visit_pages_all(uuid,timestamptz,timestamptz,integer) TO authenticated, service_role;