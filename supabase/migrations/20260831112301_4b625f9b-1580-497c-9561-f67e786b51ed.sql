CREATE OR REPLACE FUNCTION public.agent_order_units()
 RETURNS TABLE(order_id uuid, units integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT oi.order_id,
         GREATEST(SUM(oi.quantity - COALESCE(oi.returned_qty, 0)), 0)::int AS units
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('delivered', 'partial', 'partial_full', 'partial_item')
  GROUP BY oi.order_id
$function$;