ALTER TABLE public.reseller_settings
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'aurora',
  ADD COLUMN IF NOT EXISTS hero_headline text,
  ADD COLUMN IF NOT EXISTS hero_subheadline text,
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS announcement text,
  ADD COLUMN IF NOT EXISTS about_text text,
  ADD COLUMN IF NOT EXISTS support_phone text;