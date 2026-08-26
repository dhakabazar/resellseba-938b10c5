CREATE TABLE public.tutorial_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tutorials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id uuid REFERENCES public.tutorial_topics(id) ON DELETE SET NULL,
  title text NOT NULL,
  details text,
  youtube_url text NOT NULL,
  thumbnail_url text,
  duration_label text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  reseller_only boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tutorials_topic ON public.tutorials(topic_id);

GRANT SELECT ON public.tutorial_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorial_topics TO authenticated;
GRANT ALL ON public.tutorial_topics TO service_role;

GRANT SELECT ON public.tutorials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutorials TO authenticated;
GRANT ALL ON public.tutorials TO service_role;

ALTER TABLE public.tutorial_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active topics"
  ON public.tutorial_topics FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage topics"
  ON public.tutorial_topics FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']));

CREATE POLICY "Public can read public tutorials"
  ON public.tutorials FOR SELECT TO anon
  USING (is_active = true AND reseller_only = false);

CREATE POLICY "Signed in users can read active tutorials"
  ON public.tutorials FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage tutorials"
  ON public.tutorials FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.has_any_permission(auth.uid(), ARRAY['settings.manage','landing.manage']));

CREATE TRIGGER update_tutorial_topics_updated_at BEFORE UPDATE ON public.tutorial_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tutorials_updated_at BEFORE UPDATE ON public.tutorials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();