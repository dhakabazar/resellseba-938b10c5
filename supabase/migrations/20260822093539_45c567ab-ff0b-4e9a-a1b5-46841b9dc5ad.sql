CREATE OR REPLACE FUNCTION public.recalc_order_packaging(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sum boolean;
  v_total numeric(12,2);
BEGIN
  SELECT COALESCE((advanced_settings->>'packagingChargeSum')::boolean, true)
    INTO v_sum FROM public.global_settings WHERE id = 1;
  v_sum := COALESCE(v_sum, true);

  IF v_sum THEN
    SELECT COALESCE(SUM(COALESCE(p.packaging_cost,0) * oi.quantity), 0) INTO v_total
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id;
  ELSE
    SELECT COALESCE(MAX(COALESCE(p.packaging_cost,0)), 0) INTO v_total
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id;
  END IF;

  UPDATE public.orders o SET packaging_total = v_total WHERE o.id = _order_id;
END $function$;