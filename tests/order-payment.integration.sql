-- Safe integration regression: all temporary rows are rolled back.
BEGIN;
DO $test$
DECLARE oid uuid; result text; o public.orders%ROWTYPE;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 INSERT INTO public.orders(customer_name,customer_phone,address_line,area,total,subtotal,shipping_cost,sa_cost_total,status,advance_amount,advance_by)
 VALUES('Payment integration rollback','01700000000','Internal test','inside_dhaka',1500,1400,100,900,'draft',500,'admin') RETURNING id INTO oid;
 result:=public.record_verified_order_payment(oid,'test-provider','integration-'||oid::text,1000,'admin');
 IF result<>'paid' THEN RAISE EXCEPTION 'Remaining 1000 capture must mark 1500 order paid'; END IF;
 result:=public.record_verified_order_payment(oid,'test-provider','integration-'||oid::text,1000,'admin');
 SELECT * INTO o FROM public.orders WHERE id=oid;
 IF o.advance_amount<>1500 OR o.paid_amount<>1500 THEN RAISE EXCEPTION 'Duplicate capture double-counted'; END IF;
 BEGIN
  PERFORM public.record_verified_order_payment(oid,'test-provider','extra-'||oid::text,1,'admin');
  RAISE EXCEPTION 'Overcollection accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Overcollection accepted' THEN RAISE; END IF;
 END;
 UPDATE public.orders SET status='cancelled' WHERE id=oid;
 BEGIN
  UPDATE public.orders SET paid_amount=0 WHERE id=oid;
  RAISE EXCEPTION 'Cancelled cash removal accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Cancelled cash removal accepted' THEN RAISE; END IF;
 END;
 SELECT * INTO o FROM public.orders WHERE id=oid;
 IF o.advance_amount<>1500 OR o.advance_by<>'admin' OR o.reseller_profit<>0 THEN RAISE EXCEPTION 'Cancelled cash or payout changed'; END IF;
 RAISE NOTICE 'PASS: remainder capture, duplicate retry, excess rejection and cancelled cash';
END $test$;
ROLLBACK;