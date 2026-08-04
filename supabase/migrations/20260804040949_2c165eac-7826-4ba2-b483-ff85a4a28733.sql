-- Recreate the public lists as invoker (visitor-permission) views
DROP VIEW IF EXISTS public.public_marketing_pixels;
DROP VIEW IF EXISTS public.public_payment_methods;

CREATE VIEW public.public_marketing_pixels
WITH (security_invoker = true) AS
  SELECT id, reseller_id, platform, pixel_id
  FROM public.marketing_configs
  WHERE is_active = true;

CREATE VIEW public.public_payment_methods
WITH (security_invoker = true) AS
  SELECT id, reseller_id, method, label, instructions, mode
  FROM public.payment_configs
  WHERE is_active = true;

GRANT SELECT ON public.public_marketing_pixels TO anon, authenticated;
GRANT SELECT ON public.public_payment_methods TO anon, authenticated;

-- Anonymous visitors: row access limited to active rows, column access limited to safe fields
CREATE POLICY "Marketing: anon read active safe"
  ON public.marketing_configs FOR SELECT TO anon
  USING (is_active);

CREATE POLICY "Payments: anon read active safe"
  ON public.payment_configs FOR SELECT TO anon
  USING (is_active);

REVOKE SELECT ON public.marketing_configs FROM anon;
GRANT SELECT (id, reseller_id, platform, pixel_id, is_active) ON public.marketing_configs TO anon;

REVOKE SELECT ON public.payment_configs FROM anon;
GRANT SELECT (id, reseller_id, method, label, instructions, mode, is_active) ON public.payment_configs TO anon;