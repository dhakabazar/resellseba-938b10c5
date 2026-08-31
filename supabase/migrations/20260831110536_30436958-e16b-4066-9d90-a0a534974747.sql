ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS commission_mode text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS commission_per_unit numeric NOT NULL DEFAULT 0;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_commission_mode_check;
ALTER TABLE public.agents
  ADD CONSTRAINT agents_commission_mode_check CHECK (commission_mode IN ('percent', 'per_product'));

CREATE OR REPLACE FUNCTION public.agent_order_units()
RETURNS TABLE (order_id uuid, units integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT oi.order_id,
         GREATEST(SUM(oi.quantity - COALESCE(oi.returned_qty, 0)), 0)::int AS units
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status IN ('delivered', 'partial', 'partial_full', 'partial_item', 'damaged')
  GROUP BY oi.order_id
$$;

GRANT EXECUTE ON FUNCTION public.agent_order_units() TO authenticated;