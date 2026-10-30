CREATE OR REPLACE FUNCTION public.order_phone_counts(_phones text[])
RETURNS TABLE(phone text, cnt int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT o.customer_phone, count(*)::int
  FROM public.orders o
  WHERE o.customer_phone = ANY(_phones)
  GROUP BY o.customer_phone
  HAVING count(*) > 1
$$;
GRANT EXECUTE ON FUNCTION public.order_phone_counts(text[]) TO authenticated;