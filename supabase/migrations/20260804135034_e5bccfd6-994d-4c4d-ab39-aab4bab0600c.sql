DROP POLICY IF EXISTS "Products: public read active" ON public.products;
CREATE POLICY "Products: anon read active" ON public.products FOR SELECT TO anon USING (is_active);
CREATE POLICY "Products: auth read active" ON public.products FOR SELECT TO authenticated USING (is_active OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Cats: public read active" ON public.categories;
CREATE POLICY "Cats: anon read active" ON public.categories FOR SELECT TO anon USING (is_active);
CREATE POLICY "Cats: auth read active" ON public.categories FOR SELECT TO authenticated USING (is_active OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Brands: public read active" ON public.brands;
CREATE POLICY "Brands: anon read active" ON public.brands FOR SELECT TO anon USING (is_active);
CREATE POLICY "Brands: auth read active" ON public.brands FOR SELECT TO authenticated USING (is_active OR public.is_super_admin(auth.uid()));