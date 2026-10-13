CREATE OR REPLACE FUNCTION public.confirm_manual_payment(_order_id uuid, _amount numeric)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.orders%ROWTYPE; pc public.payment_configs%ROWTYPE; v_amt numeric; v_status text; v_receiver text; v_admin boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF _amount IS NULL OR _amount<0 OR _amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a valid confirmed total'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 v_admin := public.is_super_admin(auth.uid());
 IF o.payment_config_id IS NOT NULL THEN
   SELECT * INTO pc FROM public.payment_configs WHERE id=o.payment_config_id AND mode='manual' AND (reseller_id IS NULL OR reseller_id=o.reseller_id);
   IF NOT FOUND THEN RAISE EXCEPTION 'Receiving account not found'; END IF;
   v_receiver:=CASE WHEN pc.reseller_id IS NULL THEN 'admin' ELSE 'reseller' END;
   IF NOT(v_admin OR (pc.reseller_id IS NOT NULL AND pc.reseller_id=public.current_reseller_id())) THEN RAISE EXCEPTION 'Only the receiving account owner can confirm this payment'; END IF;
 ELSE
   -- Panel-created online-method order (no checkout account): receiver is whoever verifies it.
   IF o.payment_method='cod' THEN RAISE EXCEPTION 'Cash on delivery orders are settled by the courier'; END IF;
   IF v_admin THEN v_receiver:='admin';
   ELSIF o.reseller_id IS NOT NULL AND o.reseller_id=public.current_reseller_id() THEN v_receiver:='reseller';
   ELSE RAISE EXCEPTION 'Not allowed to confirm this payment'; END IF;
   IF o.advance_by IS NOT NULL AND public.order_prepaid(o.advance_amount,o.paid_amount)>0 AND o.advance_by<>v_receiver THEN
     RAISE EXCEPTION 'Only the recorded receiver can update this payment'; END IF;
 END IF;
 v_amt:=round(_amount,2);
 IF v_amt<public.order_prepaid(o.advance_amount,o.paid_amount) THEN RAISE EXCEPTION 'Confirmed money cannot be reduced through payment verification'; END IF;
 IF v_amt>o.total THEN RAISE EXCEPTION 'Confirmed money cannot exceed the order total'; END IF;
 IF o.status='cancelled' THEN RAISE EXCEPTION 'Cancelled order advance stays unchanged'; END IF;
 UPDATE public.orders SET paid_amount=v_amt,advance_amount=v_amt,advance_by=CASE WHEN v_amt>0 THEN v_receiver ELSE advance_by END,
   paid_at=CASE WHEN v_amt>0 THEN coalesce(paid_at,now()) ELSE paid_at END WHERE id=_order_id RETURNING payment_status::text INTO v_status;
 RETURN v_status;
END $function$;

CREATE OR REPLACE FUNCTION public.capi_order(p_order_number text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object('id',o.id,'order_number',o.order_number,'total',o.total,'shipping_cost',o.shipping_cost,
    'customer_name',o.customer_name,'customer_phone',o.customer_phone,'address_line',o.address_line,'area',o.area,
    'payment_method',o.payment_method,'payment_status',o.payment_status,'created_at',o.created_at,'reseller_id',o.reseller_id,
    'payment_manual',o.payment_config_id IS NOT NULL,'paid_amount',public.order_prepaid(o.advance_amount,o.paid_amount),
    'order_items',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'product_id',i.product_id,'product_name',i.product_name,
      'reseller_price',i.reseller_price,'quantity',i.quantity)) FROM order_items i WHERE i.order_id=o.id),'[]'::jsonb))
  FROM orders o
  WHERE o.order_number = regexp_replace(trim(p_order_number),'^#','')
     OR o.order_number = '#'||regexp_replace(trim(p_order_number),'^#','')
  LIMIT 1
$function$;