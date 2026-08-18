CREATE TABLE public.store_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  path text NOT NULL DEFAULT '/',
  referrer text,
  session_key text NOT NULL,
  device text NOT NULL DEFAULT 'desktop',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_visits TO authenticated;
GRANT ALL ON public.store_visits TO service_role;

ALTER TABLE public.store_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reseller can view own store visits"
ON public.store_visits FOR SELECT TO authenticated
USING (reseller_id = public.current_reseller_id());

CREATE POLICY "Admins can view store visits"
ON public.store_visits FOR SELECT TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['dashboard.view','reports.view','finance.view','resellers.manage']));

CREATE POLICY "Admins can delete store visits"
ON public.store_visits FOR DELETE TO authenticated
USING (public.has_any_permission(auth.uid(), ARRAY['reports.view','resellers.manage','settings.manage']));

CREATE INDEX store_visits_reseller_created_idx ON public.store_visits (reseller_id, created_at DESC);
CREATE INDEX store_visits_created_idx ON public.store_visits (created_at DESC);

CREATE OR REPLACE FUNCTION public.log_store_visit(_code text, _path text, _referrer text, _session_key text, _device text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  IF _session_key IS NULL OR length(_session_key) < 6 THEN RETURN; END IF;
  SELECT id INTO v_id FROM public.resellers WHERE code = _code AND status = 'active' LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.store_visits (reseller_id, path, referrer, session_key, device)
  VALUES (v_id, COALESCE(NULLIF(left(_path, 300), ''), '/'), NULLIF(left(COALESCE(_referrer,''), 300), ''),
          left(_session_key, 64), COALESCE(NULLIF(_device, ''), 'desktop'));

  IF random() < 0.02 THEN
    DELETE FROM public.store_visits WHERE created_at < now() - interval '30 days';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.log_store_visit(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.store_visit_access(_reseller_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.has_any_permission(auth.uid(), ARRAY['dashboard.view','reports.view','finance.view','resellers.manage'])
    OR (_reseller_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.resellers r WHERE r.id = _reseller_id AND r.user_id = auth.uid()))
  );
$$;

CREATE OR REPLACE FUNCTION public.store_visit_summary(_reseller_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(visits bigint, visitors bigint, live bigint, today_visits bigint, last_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.store_visit_access(_reseller_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT COUNT(*)::bigint,
         COUNT(DISTINCT v.session_key)::bigint,
         COUNT(DISTINCT CASE WHEN v.created_at > now() - interval '5 minutes' THEN v.session_key END)::bigint,
         COUNT(CASE WHEN v.created_at >= date_trunc('day', now()) THEN 1 END)::bigint,
         MAX(v.created_at)
  FROM public.store_visits v
  WHERE (_reseller_id IS NULL OR v.reseller_id = _reseller_id)
    AND (_from IS NULL OR v.created_at >= _from)
    AND (_to IS NULL OR v.created_at < _to);
END $$;

GRANT EXECUTE ON FUNCTION public.store_visit_summary(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_visit_daily(_reseller_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(day date, visits bigint, visitors bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.store_visit_access(_reseller_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT date_trunc('day', v.created_at)::date,
         COUNT(*)::bigint,
         COUNT(DISTINCT v.session_key)::bigint
  FROM public.store_visits v
  WHERE (_reseller_id IS NULL OR v.reseller_id = _reseller_id)
    AND (_from IS NULL OR v.created_at >= _from)
    AND (_to IS NULL OR v.created_at < _to)
  GROUP BY 1 ORDER BY 1;
END $$;

GRANT EXECUTE ON FUNCTION public.store_visit_daily(uuid, timestamptz, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_visit_pages(_reseller_id uuid, _from timestamptz, _to timestamptz, _limit integer DEFAULT 15)
RETURNS TABLE(path text, visits bigint, visitors bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.store_visit_access(_reseller_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT v.path, COUNT(*)::bigint, COUNT(DISTINCT v.session_key)::bigint
  FROM public.store_visits v
  WHERE (_reseller_id IS NULL OR v.reseller_id = _reseller_id)
    AND (_from IS NULL OR v.created_at >= _from)
    AND (_to IS NULL OR v.created_at < _to)
  GROUP BY 1 ORDER BY 2 DESC LIMIT GREATEST(COALESCE(_limit, 15), 1);
END $$;

GRANT EXECUTE ON FUNCTION public.store_visit_pages(uuid, timestamptz, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.store_visit_leaderboard(_from timestamptz, _to timestamptz, _limit integer DEFAULT 50)
RETURNS TABLE(reseller_id uuid, code text, business_name text, visits bigint, visitors bigint, live bigint, last_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['dashboard.view','reports.view','finance.view','resellers.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT r.id, r.code, r.business_name,
         COUNT(v.id)::bigint,
         COUNT(DISTINCT v.session_key)::bigint,
         COUNT(DISTINCT CASE WHEN v.created_at > now() - interval '5 minutes' THEN v.session_key END)::bigint,
         MAX(v.created_at)
  FROM public.resellers r
  JOIN public.store_visits v ON v.reseller_id = r.id
    AND (_from IS NULL OR v.created_at >= _from)
    AND (_to IS NULL OR v.created_at < _to)
  GROUP BY r.id, r.code, r.business_name
  ORDER BY 4 DESC, 7 DESC
  LIMIT GREATEST(COALESCE(_limit, 50), 1);
END $$;

GRANT EXECUTE ON FUNCTION public.store_visit_leaderboard(timestamptz, timestamptz, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_store_visits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_any_permission(auth.uid(), ARRAY['reports.view','resellers.manage','settings.manage']) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  DELETE FROM public.store_visits WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

GRANT EXECUTE ON FUNCTION public.purge_store_visits() TO authenticated;