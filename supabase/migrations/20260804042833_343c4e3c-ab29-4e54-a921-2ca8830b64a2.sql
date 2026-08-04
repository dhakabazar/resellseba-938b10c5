ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready_to_ship';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'pending_return';

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS courier_status text,
  ADD COLUMN IF NOT EXISTS delivery_charge numeric(12,2),
  ADD COLUMN IF NOT EXISTS cod_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS courier_note text;

CREATE TABLE IF NOT EXISTS public.courier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE SET NULL,
  provider public.courier_provider NOT NULL DEFAULT 'steadfast',
  source text NOT NULL DEFAULT 'webhook',
  notification_type text,
  courier_status text NOT NULL,
  consignment_id text,
  tracking_code text,
  cod_amount numeric(12,2),
  delivery_charge numeric(12,2),
  note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.courier_events TO authenticated;
GRANT ALL ON public.courier_events TO service_role;

ALTER TABLE public.courier_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all courier events"
ON public.courier_events FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Resellers can view own order courier events"
ON public.courier_events FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.resellers r ON r.id = o.reseller_id
  WHERE o.id = courier_events.order_id AND r.user_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS idx_courier_events_order ON public.courier_events(order_id, event_at DESC);
CREATE INDEX IF NOT EXISTS idx_courier_events_consignment ON public.courier_events(consignment_id);
CREATE INDEX IF NOT EXISTS idx_shipments_consignment ON public.shipments(consignment_id);