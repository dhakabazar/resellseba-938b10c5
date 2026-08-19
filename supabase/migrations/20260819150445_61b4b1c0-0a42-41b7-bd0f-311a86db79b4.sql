CREATE POLICY "Staff manage catalog branding images" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] IN ('categories','brands','global')
  AND public.has_permission(auth.uid(), 'products.manage')
)
WITH CHECK (
  bucket_id = 'branding'
  AND (storage.foldername(name))[1] IN ('categories','brands','global')
  AND public.has_permission(auth.uid(), 'products.manage')
);