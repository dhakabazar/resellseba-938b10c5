ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS deposit_texts jsonb NOT NULL DEFAULT '{}'::jsonb;