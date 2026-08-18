CREATE TABLE public.reseller_menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.reseller_menu_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'custom' CHECK (kind IN ('home','all_products','category','product','custom')),
  ref_slug text,
  url text,
  image_url text,
  description text,
  open_new_tab boolean NOT NULL DEFAULT false,
  layout text NOT NULL DEFAULT 'dropdown' CHECK (layout IN ('dropdown','mega')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reseller_menu_items_reseller ON public.reseller_menu_items (reseller_id, sort_order);
CREATE INDEX idx_reseller_menu_items_parent ON public.reseller_menu_items (parent_id);

GRANT SELECT ON public.reseller_menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reseller_menu_items TO authenticated;
GRANT ALL ON public.reseller_menu_items TO service_role;

ALTER TABLE public.reseller_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu: public read active" ON public.reseller_menu_items FOR SELECT USING (is_active = true);
CREATE POLICY "Menu: owner manage" ON public.reseller_menu_items FOR ALL TO authenticated
  USING (reseller_id = public.current_reseller_id())
  WITH CHECK (reseller_id = public.current_reseller_id());
CREATE POLICY "Menu: admin manage" ON public.reseller_menu_items FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_reseller_menu_items_updated BEFORE UPDATE ON public.reseller_menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();