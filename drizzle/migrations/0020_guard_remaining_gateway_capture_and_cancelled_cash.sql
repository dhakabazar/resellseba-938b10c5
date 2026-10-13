DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.record_verified_order_payment(uuid,text,text,numeric,text)'::regprocedure) INTO def;
 def:=replace(def,'IF o.status IN (''cancelled'',''returned'')','IF o.status IN (''cancelled'',''returned'',''pending_return'')');
 def:=replace(def,'IF v_pre>=o.total THEN RETURN o.payment_status::text; END IF;', 'IF nullif(btrim(_provider),'''') IS NULL OR _receiver IS NULL THEN RAISE EXCEPTION ''Invalid payment account''; END IF;
 IF round(v_pre+coalesce(o.received_amount,0)+_amount,2)>round(o.total,2) THEN RAISE EXCEPTION ''Verified payment exceeds remaining customer balance''; END IF;');
 EXECUTE def;
 SELECT pg_get_functiondef('public.normalize_order_payment()'::regprocedure) INTO def;
 def:=replace(def,'v_received:=NEW.advance_amount+', 'IF TG_OP=''UPDATE'' AND (OLD.status=''cancelled'' OR NEW.status=''cancelled'') AND (NEW.advance_amount IS DISTINCT FROM OLD.advance_amount OR NEW.advance_by IS DISTINCT FROM OLD.advance_by) THEN RAISE EXCEPTION ''Cancelled order advance stays with its receiving owner''; END IF;
 v_received:=NEW.advance_amount+');
 EXECUTE def;
END $patch$;