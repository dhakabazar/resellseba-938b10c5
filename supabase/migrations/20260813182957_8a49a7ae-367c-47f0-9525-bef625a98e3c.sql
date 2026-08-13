UPDATE public.global_settings
SET landing_content = jsonb_set(
  jsonb_set(
    landing_content,
    '{about,badge}',
    '""'::jsonb
  ),
  '{about,flow}',
  COALESCE(
    (
      SELECT jsonb_agg(
        CASE
          WHEN (elem->>'title') = 'প্রফিট জমা' THEN jsonb_set(elem, '{icon}', '"Coins"'::jsonb)
          ELSE elem
        END
      )
      FROM jsonb_array_elements(landing_content->'about'->'flow') AS elem
    ),
    landing_content->'about'->'flow'
  )
)
WHERE id = 1;
