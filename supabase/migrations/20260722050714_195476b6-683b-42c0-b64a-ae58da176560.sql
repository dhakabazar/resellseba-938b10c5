
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'reseller', 'leader', 'staff');
CREATE TYPE public.reseller_status AS ENUM ('pending', 'active', 'suspended', 'rejected');

-- =========================================================
-- HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles: read own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles: insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Roles: read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

CREATE POLICY "Roles: super admin sees all" ON public.user_roles FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Roles: super admin manages" ON public.user_roles FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- GLOBAL SETTINGS (single row, super admin edits)
-- =========================================================
CREATE TABLE public.global_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'ResellHub',
  tagline TEXT DEFAULT 'Bangladesh er #1 reseller platform',
  logo_url TEXT,
  favicon_url TEXT,
  og_image_url TEXT,
  primary_color TEXT DEFAULT 'oklch(0.55 0.20 260)',
  accent_color TEXT DEFAULT 'oklch(0.75 0.18 60)',
  meta_title_template TEXT DEFAULT '%s | ResellHub',
  meta_description TEXT DEFAULT 'Bangladesh er top reseller platform',
  contact_email TEXT,
  contact_phone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.global_settings TO anon, authenticated;
GRANT ALL ON public.global_settings TO service_role;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global: read all" ON public.global_settings FOR SELECT USING (true);
CREATE POLICY "Global: admin write" ON public.global_settings FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
INSERT INTO public.global_settings (id) VALUES (1);
CREATE TRIGGER trg_global_updated BEFORE UPDATE ON public.global_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RESELLERS
-- =========================================================
CREATE TABLE public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  status public.reseller_status NOT NULL DEFAULT 'pending',
  business_name TEXT NOT NULL,
  contact_phone TEXT,
  address TEXT,
  nid_number TEXT,
  leader_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resellers: read own" ON public.resellers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Resellers: admin read all" ON public.resellers FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Resellers: signup own" ON public.resellers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Resellers: update own limited" ON public.resellers FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Resellers: admin manages" ON public.resellers FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_resellers_updated BEFORE UPDATE ON public.resellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: current user's reseller id
CREATE OR REPLACE FUNCTION public.current_reseller_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.resellers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- =========================================================
-- RESELLER SETTINGS
-- =========================================================
CREATE TABLE public.reseller_settings (
  reseller_id UUID PRIMARY KEY REFERENCES public.resellers(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  tagline TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  og_image_url TEXT,
  primary_color TEXT DEFAULT 'oklch(0.55 0.20 260)',
  accent_color TEXT DEFAULT 'oklch(0.75 0.18 60)',
  whatsapp TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  meta_description TEXT,
  footer_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reseller_settings TO authenticated;
GRANT ALL ON public.reseller_settings TO service_role;
ALTER TABLE public.reseller_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rsettings: public read" ON public.reseller_settings FOR SELECT USING (true);
CREATE POLICY "Rsettings: owner manage" ON public.reseller_settings FOR ALL TO authenticated
USING (reseller_id = public.current_reseller_id())
WITH CHECK (reseller_id = public.current_reseller_id());
CREATE POLICY "Rsettings: admin manage" ON public.reseller_settings FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_rsettings_updated BEFORE UPDATE ON public.reseller_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- RESELLER DOMAINS
-- =========================================================
CREATE TABLE public.reseller_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  cloudflare_hostname_id TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reseller_domains TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reseller_domains TO authenticated;
GRANT ALL ON public.reseller_domains TO service_role;
ALTER TABLE public.reseller_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rdomain: public read" ON public.reseller_domains FOR SELECT USING (true);
CREATE POLICY "Rdomain: owner manage" ON public.reseller_domains FOR ALL TO authenticated
USING (reseller_id = public.current_reseller_id())
WITH CHECK (reseller_id = public.current_reseller_id());
CREATE POLICY "Rdomain: admin manage" ON public.reseller_domains FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- =========================================================
-- BRANDS
-- =========================================================
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brands TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands: public read active" ON public.brands FOR SELECT USING (is_active OR public.is_super_admin(auth.uid()));
CREATE POLICY "Brands: admin manage" ON public.brands FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- CATEGORIES
-- =========================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  description TEXT,
  meta_title TEXT,
  meta_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cats: public read active" ON public.categories FOR SELECT USING (is_active OR public.is_super_admin(auth.uid()));
CREATE POLICY "Cats: admin manage" ON public.categories FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_cats_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- PRODUCTS
-- =========================================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  short_description TEXT,
  description TEXT,
  -- Cost breakdown (SA -> reseller visible)
  buying_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  packaging_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_inside NUMERIC(12,2) NOT NULL DEFAULT 60,
  delivery_outside NUMERIC(12,2) NOT NULL DEFAULT 120,
  suggested_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  weight_grams INT,
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  keywords TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products: public read active" ON public.products FOR SELECT USING (is_active OR public.is_super_admin(auth.uid()));
CREATE POLICY "Products: admin manage" ON public.products FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_products_brand ON public.products(brand_id);
CREATE INDEX idx_products_category ON public.products(category_id);

-- =========================================================
-- PRODUCT IMAGES
-- =========================================================
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PImages: public read" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "PImages: admin manage" ON public.product_images FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX idx_pimages_product ON public.product_images(product_id);

-- =========================================================
-- RESELLER LISTINGS (reseller's own price/title over a product)
-- =========================================================
CREATE TABLE public.reseller_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_title TEXT,
  custom_description TEXT,
  selling_price NUMERIC(12,2) NOT NULL,
  extra_delivery_inside NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_delivery_outside NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(reseller_id, product_id)
);
GRANT SELECT ON public.reseller_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reseller_listings TO authenticated;
GRANT ALL ON public.reseller_listings TO service_role;
ALTER TABLE public.reseller_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings: public read active" ON public.reseller_listings FOR SELECT USING (is_active);
CREATE POLICY "Listings: owner read all" ON public.reseller_listings FOR SELECT TO authenticated
USING (reseller_id = public.current_reseller_id());
CREATE POLICY "Listings: owner manage" ON public.reseller_listings FOR ALL TO authenticated
USING (reseller_id = public.current_reseller_id())
WITH CHECK (reseller_id = public.current_reseller_id());
CREATE POLICY "Listings: admin manage" ON public.reseller_listings FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON public.reseller_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_listings_reseller ON public.reseller_listings(reseller_id);
CREATE INDEX idx_listings_product ON public.reseller_listings(product_id);
