ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}';
-- allowed_origins is configured from admin settings (no hardcoded domain).
