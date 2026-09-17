ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rider_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_status TEXT;

CREATE INDEX IF NOT EXISTS orders_rider_assigned_at_idx
  ON public.orders (rider_assigned_at DESC NULLS LAST)
  WHERE rider_assigned_at IS NOT NULL;