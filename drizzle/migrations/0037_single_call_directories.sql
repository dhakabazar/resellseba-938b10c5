-- One-call lookups (SECURITY INVOKER: existing RLS decides which rows each caller sees).
CREATE OR REPLACE FUNCTION public.reseller_directory()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'business_name', r.business_name, 'code', r.code, 'contact_phone', r.contact_phone,
    'avatar_url', r.avatar_url, 'status', r.status, 'agent_id', r.agent_id
  ) ORDER BY r.business_name), '[]'::jsonb)
  FROM public.resellers r;
$$;

CREATE OR REPLACE FUNCTION public.customer_orders(_reseller_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'reseller_id', o.reseller_id, 'customer_name', o.customer_name, 'customer_phone', o.customer_phone,
    'customer_email', o.customer_email, 'address_line', o.address_line, 'city', o.city, 'area', o.area,
    'status', o.status, 'total', o.total, 'received_amount', o.received_amount, 'created_at', o.created_at
  ) ORDER BY o.created_at DESC), '[]'::jsonb)
  FROM public.orders o
  WHERE _reseller_id IS NULL OR o.reseller_id = _reseller_id;
$$;

CREATE OR REPLACE FUNCTION public.agent_orders_with_units()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  WITH u AS (
    SELECT oi.order_id, GREATEST(SUM(oi.quantity - COALESCE(oi.returned_qty, 0)), 0)::int AS units
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.status IN ('delivered','exchanged','partial','partial_full','partial_item')
    GROUP BY oi.order_id
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'reseller_id', o.reseller_id, 'status', o.status, 'created_at', o.created_at, 'total', o.total,
    'shipping_cost', o.shipping_cost, 'sa_cost_total', o.sa_cost_total, 'received_amount', o.received_amount,
    'packaging_total', o.packaging_total, 'units', coalesce(u.units, 0)
  ) ORDER BY o.created_at DESC), '[]'::jsonb)
  FROM public.orders o LEFT JOIN u ON u.order_id = o.id;
$$;

REVOKE ALL ON FUNCTION public.reseller_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.customer_orders(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agent_orders_with_units() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reseller_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_orders(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agent_orders_with_units() TO authenticated, service_role;