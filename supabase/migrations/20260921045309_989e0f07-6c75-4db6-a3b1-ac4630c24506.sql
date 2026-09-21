CREATE OR REPLACE FUNCTION public.backup_storage_objects()
RETURNS TABLE (bucket_id text, name text, size bigint, is_public boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
  PERFORM public.backup_guard();
  RETURN QUERY
  SELECT o.bucket_id::text,
         o.name::text,
         COALESCE((o.metadata->>'size')::bigint, 0),
         b.public
  FROM storage.objects o
  JOIN storage.buckets b ON b.id = o.bucket_id
  WHERE o.name IS NOT NULL AND o.name <> '' AND right(o.name, 1) <> '/';
END $$;

CREATE OR REPLACE FUNCTION public.backup_storage_buckets()
RETURNS TABLE (id text, is_public boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, storage AS $$
BEGIN
  PERFORM public.backup_guard();
  RETURN QUERY SELECT b.id::text, b.public FROM storage.buckets b;
END $$;

REVOKE ALL ON FUNCTION public.backup_storage_objects() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.backup_storage_buckets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.backup_storage_objects() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backup_storage_buckets() TO authenticated, service_role;