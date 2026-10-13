CREATE TABLE public.order_payment_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 provider text NOT NULL,
 transaction_id text NOT NULL,
 amount numeric NOT NULL,
 receiver text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider,transaction_id)
);
GRANT SELECT ON public.order_payment_receipts TO authenticated;
GRANT ALL ON public.order_payment_receipts TO service_role;
ALTER TABLE public.order_payment_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_payment_receipts_admin_read ON public.order_payment_receipts FOR SELECT TO authenticated USING(public.has_any_permission(auth.uid(),ARRAY['orders.view','finance.view','reports.view']));
CREATE INDEX order_payment_receipts_order_idx ON public.order_payment_receipts(order_id,created_at);

CREATE OR REPLACE FUNCTION public.order_prepaid(_advance numeric,_paid numeric) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT round(greatest(coalesce(_advance,0),coalesce(_paid,0),0),2) $$;
CREATE OR REPLACE FUNCTION public.normalize_order_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_pre numeric; v_received numeric;
BEGIN
 IF NEW.advance_amount < 0 OR NEW.paid_amount < 0 OR NEW.received_amount < 0 THEN RAISE EXCEPTION 'Payment amounts cannot be negative'; END IF;
 IF TG_OP='UPDATE' AND OLD.status='cancelled' AND (NEW.advance_amount IS DISTINCT FROM OLD.advance_amount OR NEW.advance_by IS DISTINCT FROM OLD.advance_by) THEN RAISE EXCEPTION 'Cancelled order advance stays with its receiving owner'; END IF;
 IF TG_OP='UPDATE' AND NEW.advance_amount IS DISTINCT FROM OLD.advance_amount THEN
   NEW.paid_amount:=NEW.advance_amount;
 ELSIF TG_OP='UPDATE' AND NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
   NEW.advance_amount:=NEW.paid_amount;
 ELSE
   v_pre:=public.order_prepaid(NEW.advance_amount,NEW.paid_amount);
   NEW.advance_amount:=v_pre; NEW.paid_amount:=v_pre;
 END IF;
 IF NEW.advance_amount>0 AND NEW.advance_by IS NULL THEN
   NEW.advance_by:=CASE WHEN NEW.reseller_id IS NULL THEN 'admin' ELSE 'reseller' END;
 END IF;
 IF NEW.advance_by IS NOT NULL AND NEW.advance_by NOT IN ('admin','reseller') THEN RAISE EXCEPTION 'Invalid payment receiver'; END IF;
 v_received:=NEW.advance_amount+CASE WHEN NEW.status IN ('returned','pending_return','cancelled') THEN 0 ELSE coalesce(NEW.received_amount,0) END;
 IF NEW.payment_status <> 'refunded' THEN
   NEW.payment_status:=CASE WHEN v_received<=0 THEN 'unpaid'::public.payment_status WHEN round(v_received,2)>=round(NEW.total,2) THEN 'paid'::public.payment_status ELSE 'partial'::public.payment_status END;
 END IF;
 IF NEW.payment_status='paid' THEN NEW.paid_at:=coalesce(NEW.paid_at,now()); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_normalize BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.normalize_order_payment();

CREATE OR REPLACE FUNCTION public.record_verified_order_payment(_order_id uuid,_provider text,_transaction_id text,_amount numeric,_receiver text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; existing public.order_payment_receipts%ROWTYPE; v_pre numeric; v_status text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Verified server payment required'; END IF;
 IF _amount IS NULL OR _amount<=0 OR _amount::text IN ('NaN','Infinity','-Infinity') OR nullif(btrim(_transaction_id),'') IS NULL OR _receiver NOT IN ('admin','reseller') THEN RAISE EXCEPTION 'Invalid verified payment'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 SELECT * INTO existing FROM public.order_payment_receipts WHERE provider=_provider AND transaction_id=_transaction_id;
 IF FOUND THEN
   IF existing.order_id<>_order_id OR existing.amount<>round(_amount,2) THEN RAISE EXCEPTION 'Transaction already belongs to a different payment'; END IF;
   RETURN o.payment_status::text;
 END IF;
 v_pre:=public.order_prepaid(o.advance_amount,o.paid_amount);
 IF v_pre>0 AND o.advance_by IS DISTINCT FROM _receiver THEN RAISE EXCEPTION 'Use the original receiving account for remaining payments'; END IF;
 IF o.status IN ('cancelled','returned') OR o.payment_status='refunded' THEN RAISE EXCEPTION 'Order cannot receive a new payment'; END IF;
 IF v_pre>=o.total THEN RETURN o.payment_status::text; END IF;
 INSERT INTO public.order_payment_receipts(order_id,provider,transaction_id,amount,receiver) VALUES(_order_id,_provider,_transaction_id,round(_amount,2),_receiver);
 UPDATE public.orders SET advance_amount=round(v_pre+_amount,2),paid_amount=round(v_pre+_amount,2),advance_by=_receiver,payment_provider=_provider,transaction_id=_transaction_id WHERE id=_order_id RETURNING payment_status::text INTO v_status;
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION public.record_verified_order_payment(uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_verified_order_payment(uuid,text,text,numeric,text) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_manual_payment(_order_id uuid,_amount numeric) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; pc public.payment_configs%ROWTYPE; v_amt numeric; v_status text; v_receiver text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _amount IS NULL OR _amount<0 OR _amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid confirmed total'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND OR o.payment_config_id IS NULL THEN RAISE EXCEPTION 'Not a manual-payment order'; END IF;
 SELECT * INTO pc FROM public.payment_configs WHERE id=o.payment_config_id AND mode='manual' AND (reseller_id IS NULL OR reseller_id=o.reseller_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Receiving account not found'; END IF;
 v_receiver:=CASE WHEN pc.reseller_id IS NULL THEN 'admin' ELSE 'reseller' END;
 IF NOT(public.is_super_admin(auth.uid()) OR (pc.reseller_id IS NOT NULL AND pc.reseller_id=public.current_reseller_id())) THEN RAISE EXCEPTION 'Only the receiving account owner can confirm this payment'; END IF;
 v_amt:=round(_amount,2);
 IF v_amt<public.order_prepaid(o.advance_amount,o.paid_amount) THEN RAISE EXCEPTION 'Confirmed money cannot be reduced through payment verification'; END IF;
 IF o.status='cancelled' THEN RAISE EXCEPTION 'Cancelled order advance stays unchanged'; END IF;
 UPDATE public.orders SET paid_amount=v_amt,advance_amount=v_amt,advance_by=v_receiver WHERE id=_order_id RETURNING payment_status::text INTO v_status;
 RETURN v_status;
END $$;
REVOKE ALL ON FUNCTION public.confirm_manual_payment(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_manual_payment(uuid,numeric) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.sync_order_profit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_del numeric;v_pack numeric;v_recv numeric;v_prod numeric;v_adv numeric;v_res_adv numeric;
BEGIN
 v_del:=coalesce(nullif(NEW.delivery_cost,0),NEW.shipping_cost,0);v_pack:=coalesce(NEW.packaging_total,0);
 v_adv:=public.order_prepaid(NEW.advance_amount,NEW.paid_amount);v_res_adv:=CASE WHEN NEW.advance_by='reseller' THEN v_adv ELSE 0 END;
 v_recv:=coalesce(NEW.received_amount+v_adv,NEW.total,0);
 IF NEW.status IN ('returned','pending_return') THEN NEW.reseller_profit:=round(v_adv-v_del-v_pack-v_res_adv,2);
 ELSIF NEW.status='cancelled' THEN NEW.reseller_profit:=round(v_adv-v_res_adv,2);
 ELSIF NEW.status='partial_delivery' THEN NEW.reseller_profit:=round(v_recv-v_del-v_pack-v_res_adv,2);
 ELSIF NEW.status='partial_item' THEN
   IF TG_OP='INSERT' THEN v_prod:=coalesce(NEW.sa_cost_total,0)-v_pack; ELSE v_prod:=public.order_kept_product_cost(NEW.id); END IF;
   NEW.reseller_profit:=round(v_recv-v_del-v_pack-v_prod-v_res_adv,2);
 ELSIF NEW.status IN ('delivered','partial','partial_full','damaged') THEN NEW.reseller_profit:=round(v_recv-v_del-coalesce(NEW.sa_cost_total,0)-v_res_adv,2);
 ELSE NEW.reseller_profit:=round(coalesce(NEW.total,0)-v_del-coalesce(NEW.sa_cost_total,0)-v_res_adv,2); END IF;
 RETURN NEW;
END $$;