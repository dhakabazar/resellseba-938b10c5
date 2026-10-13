DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.create_exchange_order(uuid,jsonb,jsonb,numeric,numeric,numeric,text,text,boolean)'::regprocedure);
  d := replace(d, $r$v_pack := coalesce(pr.pk,0); v_sa := coalesce(pr.wp,0) + v_pack;$r$,
    $r$v_pack := coalesce(pr.pk,0); v_sa := coalesce(pr.wp,0) + v_pack;
    IF v_admin AND (it ? 'cost') AND nullif(it->>'cost','') IS NOT NULL THEN
      IF (it->>'cost')::numeric < 0 THEN RAISE EXCEPTION 'Product cost cannot be negative'; END IF;
      v_sa := (it->>'cost')::numeric;
      v_pack := least(v_pack, v_sa);
    END IF;$r$);
  EXECUTE d;
END $do$;