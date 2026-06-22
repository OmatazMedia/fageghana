
-- 1. Tighten directory_entries SELECT policies: require status='approved' to prevent
--    draft/pending/rejected/suspended rows (and their PII) from leaking to anon/authenticated.
DROP POLICY IF EXISTS "Anon view published directory entries" ON public.directory_entries;
DROP POLICY IF EXISTS "Authenticated view published directory entries" ON public.directory_entries;

CREATE POLICY "Anon view approved directory entries"
ON public.directory_entries
FOR SELECT TO anon
USING (published = true AND status = 'approved');

CREATE POLICY "Authenticated view approved directory entries"
ON public.directory_entries
FOR SELECT TO authenticated
USING (published = true AND status = 'approved');

-- 2. Membership resources: gate by min_tier
CREATE OR REPLACE FUNCTION public.user_meets_min_tier(_user_id uuid, _min_tier text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN _min_tier IS NULL OR _min_tier = '' OR _min_tier = 'associate' THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = _user_id
        AND mp.subscription_expiry IS NOT NULL
        AND mp.subscription_expiry > now()
        AND (
          (_min_tier = 'standard'  AND mp.tier IN ('standard','corporate'))
          OR (_min_tier = 'corporate' AND mp.tier = 'corporate')
        )
    )
  END;
$$;

DROP POLICY IF EXISTS "Anyone can read published resources" ON public.membership_resources;

CREATE POLICY "Read published resources by tier"
ON public.membership_resources
FOR SELECT TO anon, authenticated
USING (
  (published = true AND (
    min_tier IS NULL OR min_tier = '' OR min_tier = 'associate'
    OR public.user_meets_min_tier(auth.uid(), min_tier)
  ))
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'staff'::app_role)
);

-- 3. certificate-assets storage: restrict public reads to known public folders.
--    Signature files (if uploaded) must go to a private folder (e.g. 'signatures/')
--    which is excluded from the public allowlist; admins still have full access.
DROP POLICY IF EXISTS "Anyone read cert assets" ON storage.objects;

CREATE POLICY "Public read cert asset public folders"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'certificate-assets'
  AND (storage.foldername(name))[1] IN ('templates','qr-logos','backgrounds','public')
);
