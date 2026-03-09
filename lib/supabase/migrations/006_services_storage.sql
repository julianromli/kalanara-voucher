-- ============================================================================
-- Services Storage bucket hardening and admin write policies
-- ============================================================================

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
  updated_at = now()
WHERE id = 'services';

DROP POLICY IF EXISTS "services_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "services_images_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "services_images_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "services_images_admin_delete" ON storage.objects;

CREATE POLICY "services_images_public_read" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'services');

CREATE POLICY "services_images_admin_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'services'
    AND public.is_admin()
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
  );

CREATE POLICY "services_images_admin_update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'services'
    AND public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'services'
    AND public.is_admin()
    AND lower(storage.extension(name)) = ANY (ARRAY['jpg', 'jpeg', 'png', 'webp'])
  );

CREATE POLICY "services_images_admin_delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'services'
    AND public.is_admin()
  );
