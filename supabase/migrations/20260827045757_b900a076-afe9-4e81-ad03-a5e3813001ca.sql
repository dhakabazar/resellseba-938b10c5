ALTER TABLE public.payment_gateway_configs
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'own';

ALTER TABLE public.payment_gateway_configs
  DROP CONSTRAINT IF EXISTS payment_gateway_configs_mode_check;
ALTER TABLE public.payment_gateway_configs
  ADD CONSTRAINT payment_gateway_configs_mode_check CHECK (mode IN ('own', 'platform'));

CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_configs_platform_provider_idx
  ON public.payment_gateway_configs (provider) WHERE reseller_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_configs_reseller_provider_idx
  ON public.payment_gateway_configs (reseller_id, provider) WHERE reseller_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_configs TO authenticated;
GRANT ALL ON public.payment_gateway_configs TO service_role;

DROP POLICY IF EXISTS "Gateways: reseller own" ON public.payment_gateway_configs;
CREATE POLICY "Gateways: reseller own"
  ON public.payment_gateway_configs
  FOR ALL
  TO authenticated
  USING (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id())
  WITH CHECK (reseller_id IS NOT NULL AND reseller_id = public.current_reseller_id());