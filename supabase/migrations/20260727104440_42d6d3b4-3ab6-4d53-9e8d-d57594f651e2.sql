
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS payout_method text,
  ADD COLUMN IF NOT EXISTS payout_account_name text,
  ADD COLUMN IF NOT EXISTS payout_account_number text,
  ADD COLUMN IF NOT EXISTS payout_bank_name text,
  ADD COLUMN IF NOT EXISTS payout_branch text,
  ADD COLUMN IF NOT EXISTS payout_routing text,
  ADD COLUMN IF NOT EXISTS payout_notes text;
