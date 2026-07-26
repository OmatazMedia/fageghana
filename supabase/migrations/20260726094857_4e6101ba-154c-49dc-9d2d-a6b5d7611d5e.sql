UPDATE public.membership_resources SET min_tier = NULL WHERE min_tier = '';

ALTER TABLE public.membership_resources
  ADD CONSTRAINT membership_resources_min_tier_check
  CHECK (min_tier IS NULL OR min_tier IN ('associate','standard','corporate'));

DROP POLICY IF EXISTS "Read published resources by tier" ON public.membership_resources;

CREATE POLICY "Read published resources by tier"
ON public.membership_resources
FOR SELECT
USING (
  (
    published = true
    AND (
      min_tier IS NULL
      OR min_tier = 'associate'
      OR public.user_meets_min_tier(auth.uid(), min_tier)
    )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'staff'::app_role)
);