ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS privacy_policy TEXT;
GRANT UPDATE ON public.global_settings TO authenticated;
GRANT ALL ON public.global_settings TO service_role;