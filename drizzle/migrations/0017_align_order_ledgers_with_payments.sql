DO $migration$
DECLARE v text;
BEGIN
 SELECT pg_get_functiondef('public.transaction_report(uuid,timestamptz,timestamptz,integer)'::regprocedure) INTO v;
 v:=replace(v,'o.updated_at','coalesce(o.settled_at,o.updated_at)');
 v:=replace(v,'''damaged'',''returned'')','''damaged'',''returned'',''cancelled'')');
 v:=replace(v,'CASE WHEN o.status IN (''returned'',''cancelled'') THEN 0'||chr(10)||'                 ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - COALESCE(o.advance_amount,0), 0)) + COALESCE(o.advance_amount,0) END AS received','CASE WHEN o.status IN (''returned'',''cancelled'') THEN public.order_prepaid(o.advance_amount,o.paid_amount)'||chr(10)||'                 ELSE COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - public.order_prepaid(o.advance_amount,o.paid_amount), 0)) + public.order_prepaid(o.advance_amount,o.paid_amount) END AS received');
 v:=replace(v,'COALESCE(o.advance_amount,0)','public.order_prepaid(o.advance_amount,o.paid_amount)');
 v:=replace(v,'CASE WHEN o.status = ''partial_item''','CASE WHEN o.status = ''partial_item''');
 v:=replace(v,'COALESCE(NULLIF(o.delivery_cost,0), o.shipping_cost, 0) AS buy_delivery','CASE WHEN o.status=''cancelled'' THEN 0 ELSE COALESCE(NULLIF(o.delivery_cost,0), o.shipping_cost, 0) END AS buy_delivery');
 v:=replace(v,'COALESCE(o.packaging_total,0) AS packaging','CASE WHEN o.status=''cancelled'' THEN 0 ELSE COALESCE(o.packaging_total,0) END AS packaging');
 v:=replace(v,'ORDER BY ev.at ROWS','ORDER BY ev.at, ev.kind, ev.id, ev.order_number ROWS');
 EXECUTE v;
 SELECT pg_get_functiondef('public.reseller_ledger(uuid,integer)'::regprocedure) INTO v;
 v:=replace(v,'o.updated_at','coalesce(o.settled_at,o.updated_at)');
 v:=replace(v,'CASE WHEN o.status IN (''delivered'',''partial'') THEN ''profit'' ELSE ''loss'' END','CASE WHEN o.reseller_profit>=0 THEN ''profit'' ELSE ''loss'' END');
 v:=replace(v,'o.status NOT IN (''delivered'',''partial'')','o.reseller_profit<0');
 v:=replace(v,'o.received_amount < o.total','o.received_amount + public.order_prepaid(o.advance_amount,o.paid_amount) < o.total');
 v:=replace(v,'round(o.received_amount)::text','round(o.received_amount+public.order_prepaid(o.advance_amount,o.paid_amount))::text');
 v:=replace(v,'''delivered'',''partial'',''returned'',''cancelled''','''delivered'',''partial'',''partial_full'',''partial_item'',''partial_delivery'',''damaged'',''returned'',''cancelled''');
 EXECUTE v;
END $migration$;