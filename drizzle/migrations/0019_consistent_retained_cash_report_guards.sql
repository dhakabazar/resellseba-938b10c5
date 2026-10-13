DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.transaction_report(uuid,timestamptz,timestamptz,integer)'::regprocedure) INTO def;
 def:=replace(def, 'CASE WHEN o.status IN (''returned'',''cancelled'') THEN 0
                ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - public.order_prepaid(o.advance_amount,o.paid_amount), 0)) + public.order_prepaid(o.advance_amount,o.paid_amount) END AS received', 'CASE WHEN o.status IN (''returned'',''cancelled'') THEN public.order_prepaid(o.advance_amount,o.paid_amount)
                ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - public.order_prepaid(o.advance_amount,o.paid_amount), 0)) + public.order_prepaid(o.advance_amount,o.paid_amount) END AS received');
 def:=replace(def, 'AND o.reseller_profit <> 0', 'AND (o.reseller_profit <> 0 OR public.order_prepaid(o.advance_amount,o.paid_amount) > 0)');
 EXECUTE def;
 SELECT pg_get_functiondef('public.normalize_order_payment()'::regprocedure) INTO def;
 def:=replace(def, 'IF TG_OP=''UPDATE'' AND OLD.status=''cancelled''', 'IF TG_OP=''UPDATE'' AND (OLD.status=''cancelled'' OR NEW.status=''cancelled'')');
 def:=replace(def, ' IF NEW.advance_by IS NOT NULL', ' IF TG_OP=''UPDATE'' AND public.order_prepaid(OLD.advance_amount,OLD.paid_amount)>0 AND NEW.advance_by IS DISTINCT FROM OLD.advance_by THEN RAISE EXCEPTION ''Collected advance must stay with the original receiver''; END IF;
 IF NEW.advance_by IS NOT NULL');
 EXECUTE def;
END $patch$;