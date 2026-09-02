ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS secondary_color text,
  ADD COLUMN IF NOT EXISTS highlight_color text;