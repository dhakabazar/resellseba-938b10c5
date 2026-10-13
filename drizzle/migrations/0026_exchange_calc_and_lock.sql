ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS exchange_reseller_cost numeric,
  ADD COLUMN IF NOT EXISTS exchange_packaging numeric,
  ADD COLUMN IF NOT EXISTS exchange_admin_buy numeric,
  ADD COLUMN IF NOT EXISTS exchange_calc jsonb;

CREATE OR REPLACE FUNCTION public.exchange_order_status()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF NOT NEW.is_exchange THEN RETURN NEW; END IF;
  -- Exchange money comes from the saved calculation, not from item rates.
  IF NEW.exchange_reseller_cost IS NOT NULL THEN
    NEW.packaging_total := coalesce(NEW.exchange_packaging,0);
    NEW.sa_cost_total := NEW.exchange_reseller_cost + NEW.packaging_total;
  END IF;
  IF NEW.status = 'delivered' THEN NEW.status := 'exchanged'; END IF;
  IF NEW.exchange_state = 'requested' AND NEW.status NOT IN ('pending','forwarded','draft','cancelled') THEN
    RAISE EXCEPTION 'Exchange request must be approved by admin first';
  END IF;
  IF NEW.status = 'exchanged' AND NEW.exchange_restock AND NOT NEW.exchange_restocked THEN
    FOR r IN SELECT * FROM jsonb_array_elements(coalesce(NEW.exchange_returned_items,'[]'::jsonb)) LOOP
      IF nullif(r->>'product_id','') IS NOT NULL AND coalesce((r->>'qty')::int,0) > 0 THEN
        UPDATE public.products SET stock = stock + (r->>'qty')::int WHERE id = (r->>'product_id')::uuid;
      END IF;
    END LOOP;
    NEW.exchange_restocked := true;
  END IF;
  RETURN NEW;
END $function$;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.create_exchange_order(uuid,jsonb,jsonb,numeric,numeric,numeric,text,text,boolean)'::regprocedure);
  d := replace(d, $r$IF p.status <> 'delivered' THEN RAISE EXCEPTION 'Only delivered orders can be exchanged'; END IF;$r$,
    $r$IF p.status <> 'delivered' THEN RAISE EXCEPTION 'Only delivered orders can be exchanged'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders x WHERE x.parent_order_id = _parent AND x.is_exchange
             AND coalesce(x.exchange_state,'') <> 'rejected' AND x.status <> 'cancelled') THEN
    RAISE EXCEPTION 'This order is already exchanged (exchange locked)';
  END IF;$r$);
  EXECUTE d;
  d := pg_get_functiondef('public.admin_orders_page'::regproc);
  d := replace(d, $r$'exchange_admin_share',o.exchange_admin_share,$r$,
    $r$'exchange_admin_share',o.exchange_admin_share,'exchange_admin_buy',o.exchange_admin_buy,'exchange_calc',o.exchange_calc,$r$);
  EXECUTE d;
END $do$;

CREATE OR REPLACE FUNCTION public.save_exchange_calc(_id uuid, _calc jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.orders; v_admin boolean;
  c numeric; d numeric; pk numeric; s numeric; rc numeric; b numeric;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _id AND is_exchange;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Exchange order not found'; END IF;
  v_admin := public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'orders.edit');
  IF NOT v_admin AND (o.reseller_id IS DISTINCT FROM public.current_reseller_id() OR o.exchange_state <> 'requested') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  c := coalesce((_calc->>'customer_pays')::numeric,0);
  d := coalesce((_calc->>'delivery')::numeric,0);
  pk := coalesce((_calc->>'packaging')::numeric,0);
  s := CASE WHEN v_admin THEN coalesce((_calc->>'admin_share')::numeric,0) ELSE 0 END;
  rc := coalesce((_calc->>'reseller_cost')::numeric,0);
  b := CASE WHEN v_admin THEN (_calc->>'admin_buy')::numeric ELSE NULL END;
  IF c < 0 OR d < 0 OR pk < 0 OR s < 0 THEN RAISE EXCEPTION 'Amounts cannot be negative'; END IF;
  UPDATE public.orders SET total = c, subtotal = c, delivery_cost = d, exchange_admin_share = s,
    exchange_packaging = pk, exchange_reseller_cost = rc,
    exchange_admin_buy = CASE WHEN v_admin THEN b ELSE exchange_admin_buy END,
    exchange_calc = _calc
  WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.create_exchange_order_v2(_parent uuid, _items jsonb, _returned jsonb, _calc jsonb,
  _reason text, _note text, _restock boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.create_exchange_order(_parent, _items, _returned,
    coalesce((_calc->>'customer_pays')::numeric,0), coalesce((_calc->>'delivery')::numeric,0),
    coalesce((_calc->>'admin_share')::numeric,0), _reason, _note, _restock);
  PERFORM public.save_exchange_calc(v_id, _calc);
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.save_exchange_calc(uuid,jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.create_exchange_order_v2(uuid,jsonb,jsonb,jsonb,text,text,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_exchange_calc(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_exchange_order_v2(uuid,jsonb,jsonb,jsonb,text,text,boolean) TO authenticated;