DO $migration$ DECLARE v text; BEGIN
 SELECT pg_get_functiondef('public.sync_order_profit()'::regprocedure) INTO v;
 v:=replace(v,'ELSIF NEW.status=''cancelled'' THEN NEW.reseller_profit:=round(v_adv-v_res_adv,2);','ELSIF NEW.status=''cancelled'' THEN NEW.reseller_profit:=0;');
 EXECUTE v;
END $migration$;