DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.admin_orders_page(text[],bigint,bigint,integer)'::regprocedure) INTO definition;
 IF position('(v_statuses IS NULL OR o.status = ANY(v_statuses))' in definition)=0 THEN RAISE EXCEPTION 'Expected typed status predicate missing'; END IF;
 definition := replace(definition, '(v_statuses IS NULL OR o.status = ANY(v_statuses))', '(v_statuses IS NULL OR (cardinality(v_statuses) = 1 AND o.status = v_statuses[1]) OR (cardinality(v_statuses) > 1 AND o.status = ANY(v_statuses)))');
 EXECUTE definition;
END;
$migration$;
COMMENT ON FUNCTION public.admin_orders_page(text[],bigint,bigint,integer) IS 'Limited orders precede joins/JSON; singleton status equality directly uses the existing status-created index, grouped tabs use typed ANY, and custom planning removes inactive optional predicates.';