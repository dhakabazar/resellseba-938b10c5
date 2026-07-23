ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS flagship_reseller_code text;

-- Public can look up which reseller a custom hostname maps to (needed to resolve at root URL on custom domain).
DROP POLICY IF EXISTS "Public read verified domains" ON public.reseller_domains;
CREATE POLICY "Public read verified domains" ON public.reseller_domains FOR SELECT TO anon, authenticated
  USING (verified_at IS NOT NULL);

-- Allow anon to read the flagship code so main domain can resolve without auth.
GRANT SELECT ON public.global_settings TO anon;
DROP POLICY IF EXISTS "Public read global settings" ON public.global_settings;
CREATE POLICY "Public read global settings" ON public.global_settings FOR SELECT TO anon, authenticated
  USING (true);