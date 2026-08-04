ALTER TABLE public.reseller_settings
  ADD COLUMN IF NOT EXISTS theme_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

DROP VIEW IF EXISTS public.public_stores;

CREATE VIEW public.public_stores
WITH (security_invoker = false) AS
SELECT r.id AS reseller_id,
    r.code,
    r.business_name,
    s.store_name,
    s.tagline,
    s.logo_url,
    s.favicon_url,
    s.og_image_url,
    s.primary_color,
    s.accent_color,
    s.whatsapp,
    s.facebook_url,
    s.instagram_url,
    s.tiktok_url,
    s.meta_description,
    s.footer_text,
    s.theme,
    s.theme_settings,
    s.hero_headline,
    s.hero_subheadline,
    s.hero_image_url,
    s.announcement,
    s.about_text,
    s.support_phone
   FROM public.resellers r
     LEFT JOIN public.reseller_settings s ON s.reseller_id = r.id
  WHERE r.status = 'active'::reseller_status;

GRANT SELECT ON public.public_stores TO anon, authenticated;