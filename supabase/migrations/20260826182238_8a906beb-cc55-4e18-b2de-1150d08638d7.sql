ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS callback_base_url text;
-- callback_base_url is configured from admin settings; empty = request origin.
