ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'shurjopay';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'aamarpay';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'epayseba';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_gateway_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid REFERENCES public.resellers(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text,
  is_active boolean NOT NULL DEFAULT false,
  api_key text,
  api_secret text,
  merchant_id text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_configs_platform_uniq
  ON public.payment_gateway_configs (provider) WHERE reseller_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_gateway_configs_reseller_uniq
  ON public.payment_gateway_configs (reseller_id, provider) WHERE reseller_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_gateway_configs TO authenticated;
GRANT ALL ON public.payment_gateway_configs TO service_role;

ALTER TABLE public.payment_gateway_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage gateway configs" ON public.payment_gateway_configs;
CREATE POLICY "Super admins manage gateway configs"
ON public.payment_gateway_configs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at_pgc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pgc_updated_at ON public.payment_gateway_configs;
CREATE TRIGGER trg_pgc_updated_at BEFORE UPDATE ON public.payment_gateway_configs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_pgc();

CREATE OR REPLACE FUNCTION public.get_active_payment_gateways(_reseller_id uuid DEFAULT NULL)
RETURNS TABLE (provider text, label text, is_sandbox boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (g.provider) g.provider, g.label, COALESCE((g.config->>'is_sandbox')::boolean, true)
  FROM public.payment_gateway_configs g
  WHERE g.is_active
    AND (g.reseller_id IS NULL OR g.reseller_id = _reseller_id)
  ORDER BY g.provider, (g.reseller_id IS NOT NULL) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_payment_gateways(uuid) TO anon, authenticated, service_role;