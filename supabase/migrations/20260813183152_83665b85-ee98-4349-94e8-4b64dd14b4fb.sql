UPDATE public.global_settings
SET landing_content = jsonb_set(landing_content, '{about,title}', '""'::jsonb)
WHERE id = 1;
