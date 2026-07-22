
-- Product images: admins write, anyone reads (signed URLs)
CREATE POLICY "product_images_read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product_images_admin_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images' AND public.is_super_admin(auth.uid()));
CREATE POLICY "product_images_admin_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images' AND public.is_super_admin(auth.uid()));
CREATE POLICY "product_images_admin_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images' AND public.is_super_admin(auth.uid()));

-- Branding: path pattern is <reseller_id>/... for reseller assets, "global/..." for SA
CREATE POLICY "branding_read" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "branding_admin_all" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'branding' AND public.is_super_admin(auth.uid()))
WITH CHECK (bucket_id = 'branding' AND public.is_super_admin(auth.uid()));
CREATE POLICY "branding_reseller_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND public.current_reseller_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_reseller_id()::text
);
CREATE POLICY "branding_reseller_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding'
  AND public.current_reseller_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_reseller_id()::text
);
CREATE POLICY "branding_reseller_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding'
  AND public.current_reseller_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.current_reseller_id()::text
);
