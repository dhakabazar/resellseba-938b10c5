CREATE OR REPLACE FUNCTION public.calculate_delivery_charge(_product_id uuid, _area text)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p_inside numeric;
  p_outside numeric;
  p_mode text;
  p_flat numeric;
BEGIN
  SELECT delivery_inside, delivery_outside, delivery_mode, delivery_flat
    INTO p_inside, p_outside, p_mode, p_flat
    FROM public.products WHERE id = _product_id;

  IF p_mode = 'free' THEN RETURN 0; END IF;
  IF p_mode = 'flat' THEN RETURN COALESCE(p_flat, 0); END IF;

  RETURN COALESCE(CASE _area WHEN 'inside_dhaka' THEN p_inside ELSE p_outside END, 0);
END $function$;

DROP TABLE IF EXISTS public.delivery_rules;