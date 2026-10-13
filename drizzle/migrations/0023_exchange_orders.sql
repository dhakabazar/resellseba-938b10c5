ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_exchange boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exchange_state text,
  ADD COLUMN IF NOT EXISTS exchange_reason text,
  ADD COLUMN IF NOT EXISTS exchange_admin_share numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exchange_returned_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exchange_restock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exchange_restocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_stock_taken boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS exchange_reviewed_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_parent_order_idx ON public.orders(parent_order_id) WHERE parent_order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.exchange_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT NEW.is_exchange THEN RETURN NEW; END IF;
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
END $$;
DROP TRIGGER IF EXISTS trg_a_exchange_status ON public.orders;
CREATE TRIGGER trg_a_exchange_status BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.exchange_order_status();

CREATE OR REPLACE FUNCTION public.sync_order_profit()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE v_del numeric;v_pack numeric;v_recv numeric;v_prod numeric;v_adv numeric;v_res_adv numeric;v_share numeric;
BEGIN
 v_del:=coalesce(nullif(NEW.delivery_cost,0),NEW.shipping_cost,0);v_pack:=coalesce(NEW.packaging_total,0);
 v_adv:=public.order_prepaid(NEW.advance_amount,NEW.paid_amount);v_res_adv:=CASE WHEN NEW.advance_by='reseller' THEN v_adv ELSE 0 END;
 v_recv:=coalesce(NEW.received_amount+v_adv,NEW.total,0);
 v_share:=CASE WHEN NEW.is_exchange THEN coalesce(NEW.exchange_admin_share,0) ELSE 0 END;
 IF NEW.status IN ('returned','pending_return') THEN NEW.reseller_profit:=round(v_adv-v_del-v_pack-v_res_adv+v_share,2);
 ELSIF NEW.status='cancelled' THEN NEW.reseller_profit:=0;
 ELSIF NEW.status='partial_delivery' THEN NEW.reseller_profit:=round(v_recv-v_del-v_pack-v_res_adv+v_share,2);
 ELSIF NEW.status='partial_item' THEN
   IF TG_OP='INSERT' THEN v_prod:=coalesce(NEW.sa_cost_total,0)-v_pack; ELSE v_prod:=public.order_kept_product_cost(NEW.id); END IF;
   NEW.reseller_profit:=round(v_recv-v_del-v_pack-v_prod-v_res_adv+v_share,2);
 ELSIF NEW.status IN ('delivered','exchanged','partial','partial_full','damaged') THEN NEW.reseller_profit:=round(v_recv-v_del-coalesce(NEW.sa_cost_total,0)-v_res_adv+v_share,2);
 ELSE NEW.reseller_profit:=round(coalesce(NEW.total,0)-v_del-coalesce(NEW.sa_cost_total,0)-v_res_adv+v_share,2); END IF;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.exchange_take_stock(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE id=_id AND is_exchange AND NOT exchange_stock_taken) THEN
    UPDATE public.products pp SET stock = pp.stock - oi.quantity FROM public.order_items oi
     WHERE oi.order_id = _id AND oi.product_id = pp.id;
    UPDATE public.orders SET exchange_stock_taken = true WHERE id = _id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.exchange_take_stock(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_exchange_order(
  _parent uuid, _items jsonb, _returned jsonb, _total numeric, _delivery_cost numeric,
  _admin_share numeric, _reason text, _note text, _restock boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.orders; v_admin boolean; v_id uuid; v_n int; it jsonb; v_pid uuid; v_qty int;
  pr record; v_sa numeric; v_pack numeric; v_sa_total numeric := 0;
BEGIN
  SELECT * INTO p FROM public.orders WHERE id = _parent;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Original order not found'; END IF;
  IF p.is_exchange THEN RAISE EXCEPTION 'Create the exchange from the original order'; END IF;
  v_admin := public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'orders.edit');
  IF NOT v_admin AND (p.reseller_id IS NULL OR p.reseller_id IS DISTINCT FROM public.current_reseller_id()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Select at least one product to send'; END IF;
  IF coalesce(_total,0) < 0 OR coalesce(_delivery_cost,0) < 0 THEN RAISE EXCEPTION 'Amounts cannot be negative'; END IF;
  SELECT count(*)+1 INTO v_n FROM public.orders WHERE parent_order_id = _parent;

  INSERT INTO public.orders(order_number, reseller_id, customer_name, customer_phone, customer_email, address_line, city, area, landmark,
    subtotal, shipping_cost, discount, total, sa_cost_total, reseller_profit, payment_method, status,
    reseller_note, admin_note, forwarded_to_admin, forwarded_at, delivery_cost,
    is_exchange, parent_order_id, exchange_state, exchange_reason, exchange_admin_share, exchange_returned_items, exchange_restock,
    exchange_reviewed_by, exchange_reviewed_at)
  VALUES (p.order_number || '-EX' || v_n, p.reseller_id, p.customer_name, p.customer_phone, p.customer_email, p.address_line, p.city, p.area, p.landmark,
    coalesce(_total,0), 0, 0, coalesce(_total,0), 0, 0, 'cod', CASE WHEN v_admin THEN 'confirmed'::order_status ELSE 'pending'::order_status END,
    CASE WHEN v_admin THEN NULL ELSE _note END, CASE WHEN v_admin THEN _note ELSE NULL END, true, now(), coalesce(_delivery_cost,0),
    true, _parent, CASE WHEN v_admin THEN 'approved' ELSE 'requested' END, _reason,
    CASE WHEN v_admin THEN coalesce(_admin_share,0) ELSE 0 END, coalesce(_returned,'[]'::jsonb), coalesce(_restock,true),
    CASE WHEN v_admin THEN auth.uid() END, CASE WHEN v_admin THEN now() END)
  RETURNING id INTO v_id;

  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (it->>'product_id')::uuid; v_qty := greatest(coalesce((it->>'qty')::int,1),1);
    SELECT pp.name, pp.og_image_url, pp.sku, coalesce(rp.reseller_price, pp.reseller_price) AS wp,
           coalesce(rp.packaging_cost, pp.packaging_cost, 0) AS pk
      INTO pr FROM public.products pp
      LEFT JOIN public.reseller_product_prices rp ON rp.product_id = pp.id AND rp.reseller_id = p.reseller_id
     WHERE pp.id = v_pid;
    IF pr.name IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
    v_pack := coalesce(pr.pk,0); v_sa := coalesce(pr.wp,0) + v_pack;
    v_sa_total := v_sa_total + v_sa * v_qty;
    INSERT INTO public.order_items(order_id, product_id, product_name, product_image, sku, quantity, sa_price, reseller_price, line_total, profit, packaging_cost)
    VALUES (v_id, v_pid, pr.name, pr.og_image_url, pr.sku, v_qty, v_sa, coalesce((it->>'price')::numeric,0),
            coalesce((it->>'price')::numeric,0) * v_qty, (coalesce((it->>'price')::numeric,0) - v_sa) * v_qty, v_pack);
  END LOOP;

  UPDATE public.orders SET sa_cost_total = v_sa_total, total = coalesce(_total,0), subtotal = coalesce(_total,0) WHERE id = v_id;
  IF v_admin THEN PERFORM public.exchange_take_stock(v_id); END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_exchange_order(_id uuid, _approve boolean, _total numeric DEFAULT NULL,
  _delivery_cost numeric DEFAULT NULL, _admin_share numeric DEFAULT NULL, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.orders;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'orders.edit')) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO o FROM public.orders WHERE id=_id AND is_exchange;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Exchange order not found'; END IF;
  IF _approve THEN
    UPDATE public.orders SET exchange_state='approved',
      total = coalesce(_total,total), subtotal = coalesce(_total,subtotal),
      delivery_cost = coalesce(_delivery_cost,delivery_cost), exchange_admin_share = coalesce(_admin_share,exchange_admin_share),
      admin_note = coalesce(_note,admin_note),
      status = CASE WHEN status IN ('pending','forwarded','draft') THEN 'confirmed'::order_status ELSE status END,
      exchange_reviewed_by=auth.uid(), exchange_reviewed_at=now()
    WHERE id=_id;
    PERFORM public.exchange_take_stock(_id);
  ELSE
    UPDATE public.orders SET exchange_state='rejected', status='cancelled', admin_note=coalesce(_note,admin_note),
      exchange_reviewed_by=auth.uid(), exchange_reviewed_at=now(), stock_restored = NOT exchange_stock_taken
    WHERE id=_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_exchange_split(_id uuid, _total numeric, _delivery_cost numeric, _admin_share numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR public.has_permission(auth.uid(),'orders.edit')) THEN RAISE EXCEPTION 'not authorized'; END IF;
  UPDATE public.orders SET total=coalesce(_total,total), subtotal=coalesce(_total,subtotal),
    delivery_cost=coalesce(_delivery_cost,delivery_cost), exchange_admin_share=coalesce(_admin_share,exchange_admin_share)
   WHERE id=_id AND is_exchange;
END $$;
GRANT EXECUTE ON FUNCTION public.create_exchange_order(uuid,jsonb,jsonb,numeric,numeric,numeric,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_exchange_order(uuid,boolean,numeric,numeric,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exchange_split(uuid,numeric,numeric,numeric) TO authenticated;

DO $do$
DECLARE r record; d text;
BEGIN
  FOR r IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname = ANY (ARRAY[
    'admin_payout_overview','admin_reseller_metrics','admin_resellers_bootstrap','agent_order_units',
    'create_leader_commission_on_delivery','enforce_payout_freeze','lp_bootstrap','reseller_ledger',
    'reseller_profit_summary','transaction_report','admin_orders_page'])
  LOOP
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(d, $r$IN \('delivered', ?$r$, $r$IN ('delivered','exchanged',$r$, 'gi');
    d := replace(d, $r$WHEN 'delivered' THEN ' · full delivery$r$,
      $r$WHEN 'exchanged' THEN ' · exchange delivered, courier collected ' || round(COALESCE(o.received_amount, GREATEST(COALESCE(o.total,0) - public.order_prepaid(o.advance_amount,o.paid_amount), 0)))::text
                  WHEN 'delivered' THEN ' · full delivery$r$);
    d := replace(d, $r$'admin_note',o.admin_note,$r$, $r$'admin_note',o.admin_note,'is_exchange',o.is_exchange,'parent_order_id',o.parent_order_id,'exchange_state',o.exchange_state,'exchange_reason',o.exchange_reason,'exchange_admin_share',o.exchange_admin_share,'parent_order_number',(SELECT po.order_number FROM public.orders po WHERE po.id=o.parent_order_id),$r$);
    EXECUTE d;
  END LOOP;
END $do$;