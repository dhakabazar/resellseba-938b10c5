DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.create_exchange_order(uuid,jsonb,jsonb,numeric,numeric,numeric,text,text,boolean)'::regprocedure);
  d := replace(d, $r$IF p.is_exchange THEN RAISE EXCEPTION 'Create the exchange from the original order'; END IF;$r$,
    $r$IF p.is_exchange THEN RAISE EXCEPTION 'Create the exchange from the original order'; END IF;
  IF p.status <> 'delivered' THEN RAISE EXCEPTION 'Only delivered orders can be exchanged'; END IF;$r$);
  EXECUTE d;
END $do$;