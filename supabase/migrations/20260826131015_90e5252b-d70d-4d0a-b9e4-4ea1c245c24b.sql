ALTER TABLE public.deposit_requests
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS txn_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS deposit_requests_code_key ON public.deposit_requests (code) WHERE code IS NOT NULL;