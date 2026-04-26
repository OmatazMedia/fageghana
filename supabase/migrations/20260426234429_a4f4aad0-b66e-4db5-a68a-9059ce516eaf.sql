
-- Fix mutable search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Tighten membership_applications INSERT: still allow public submission, but require all required fields are present (non-empty), preventing trivially empty spam inserts
DROP POLICY IF EXISTS "Anyone can submit membership application" ON public.membership_applications;
CREATE POLICY "Anyone can submit membership application"
  ON public.membership_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(company_name)) > 0
    AND length(trim(contact_name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(phone)) > 0
    AND status = 'new'
  );

-- Restrict storage SELECT policy to specific content prefixes (still public-readable for the site, but does not allow listing the entire bucket)
DROP POLICY IF EXISTS "Public can view content images" ON storage.objects;
CREATE POLICY "Public can view content files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'content'
    AND (storage.foldername(name))[1] IN ('news', 'products', 'activities', 'media', 'public')
  );
