CREATE TABLE public.admin_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info',
  is_active boolean NOT NULL DEFAULT true,
  is_dismissible boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  cta_label text,
  cta_url text,
  image_url text,
  target_reseller_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_notice_dismissals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id uuid NOT NULL REFERENCES public.admin_notices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notice_id, user_id)
);

GRANT SELECT ON public.admin_notices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_notices TO authenticated;
GRANT ALL ON public.admin_notices TO service_role;
GRANT SELECT, INSERT, DELETE ON public.admin_notice_dismissals TO authenticated;
GRANT ALL ON public.admin_notice_dismissals TO service_role;

ALTER TABLE public.admin_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notice_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notices" ON public.admin_notices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users read live notices" ON public.admin_notices FOR SELECT TO authenticated
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

CREATE POLICY "Users manage own dismissals" ON public.admin_notice_dismissals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER admin_notices_updated_at BEFORE UPDATE ON public.admin_notices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX admin_notices_live_idx ON public.admin_notices (is_active, starts_at, ends_at);