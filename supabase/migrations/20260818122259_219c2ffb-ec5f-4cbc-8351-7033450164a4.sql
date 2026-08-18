-- Cloudflare credentials (admin-managed, never exposed to the browser)
CREATE TABLE IF NOT EXISTS public.cloudflare_config (
  id INT PRIMARY KEY DEFAULT 1,
  api_token TEXT,
  account_id TEXT,
  zone_id TEXT,
  zone_name TEXT,
  worker_name TEXT,
  cname_target TEXT,
  a_record_ip TEXT,
  auto_worker_domain BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cloudflare_config_singleton CHECK (id = 1)
);
INSERT INTO public.cloudflare_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Secrets stay server-side only: no anon/authenticated grants, RLS on with no policies.
REVOKE ALL ON public.cloudflare_config FROM anon, authenticated;
GRANT ALL ON public.cloudflare_config TO service_role;
ALTER TABLE public.cloudflare_config ENABLE ROW LEVEL SECURITY;

-- Extra state for Cloudflare custom hostname / worker domain provisioning
ALTER TABLE public.reseller_domains
  ADD COLUMN IF NOT EXISTS verification_txt_name TEXT,
  ADD COLUMN IF NOT EXISTS verification_txt_value TEXT,
  ADD COLUMN IF NOT EXISTS dns_target TEXT,
  ADD COLUMN IF NOT EXISTS ownership_status TEXT,
  ADD COLUMN IF NOT EXISTS worker_domain_id TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;