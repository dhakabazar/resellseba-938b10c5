DO $$
DECLARE d text; o text;
BEGIN
  -- admin_dashboard
  d := pg_get_functiondef('public.admin_dashboard(timestamptz,timestamptz)'::regprocedure);
  o := d;
  d := replace(d, 'limit 5000', 'limit 100000000');
  d := replace(d, 'limit 20000', 'limit 100000000');
  IF d <> o THEN EXECUTE d; END IF;

  -- reseller_dashboard
  d := pg_get_functiondef('public.reseller_dashboard(timestamptz,timestamptz)'::regprocedure);
  o := d;
  d := replace(d, 'limit 5000', 'limit 100000000');
  IF d <> o THEN EXECUTE d; END IF;

  -- admin_payout_overview
  d := pg_get_functiondef('public.admin_payout_overview(text,text,text,integer,integer,boolean)'::regprocedure);
  o := d;
  d := replace(d, 'LIMIT GREATEST(LEAST(COALESCE(_limit,50), 500), 1)', 'LIMIT GREATEST(COALESCE(NULLIF(_limit,0), 100000000), 1)');
  IF d <> o THEN EXECUTE d; END IF;

  -- transaction_report
  d := pg_get_functiondef('public.transaction_report(uuid,timestamptz,timestamptz,integer)'::regprocedure);
  o := d;
  d := replace(d, 'COALESCE(_limit, 500)', 'COALESCE(NULLIF(_limit,0), 100000000)');
  IF d <> o THEN EXECUTE d; END IF;

  -- reseller_ledger
  d := pg_get_functiondef('public.reseller_ledger(uuid,integer)'::regprocedure);
  o := d;
  d := replace(d, 'LIMIT GREATEST(_limit, 1)', 'LIMIT GREATEST(COALESCE(NULLIF(_limit,0), 100000000), 1)');
  IF d <> o THEN EXECUTE d; END IF;

  -- store_visit_leaderboard
  d := pg_get_functiondef('public.store_visit_leaderboard(timestamptz,timestamptz,integer)'::regprocedure);
  o := d;
  d := replace(d, 'COALESCE(_limit, 50)', 'COALESCE(NULLIF(_limit,0), 100000000)');
  IF d <> o THEN EXECUTE d; END IF;

  -- store_visit_pages
  d := pg_get_functiondef('public.store_visit_pages(uuid,timestamptz,timestamptz,integer)'::regprocedure);
  o := d;
  d := replace(d, 'COALESCE(_limit, 15)', 'COALESCE(NULLIF(_limit,0), 100000000)');
  IF d <> o THEN EXECUTE d; END IF;
END $$;