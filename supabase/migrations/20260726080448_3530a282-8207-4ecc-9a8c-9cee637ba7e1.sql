
CREATE OR REPLACE FUNCTION public.public_search_members(_q text)
RETURNS TABLE(
  contact_name text,
  company_name text,
  member_id text,
  tier membership_tier,
  subscription_expiry timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contact_name, company_name, member_id, tier, subscription_expiry
  FROM public.member_profiles
  WHERE member_id IS NOT NULL
    AND _q IS NOT NULL
    AND length(trim(_q)) >= 2
    AND (
      member_id ILIKE '%' || _q || '%'
      OR company_name ILIKE '%' || _q || '%'
      OR contact_name ILIKE '%' || _q || '%'
      OR email ILIKE '%' || _q || '%'
    )
  ORDER BY
    CASE WHEN member_id ILIKE _q THEN 0 ELSE 1 END,
    company_name NULLS LAST
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.public_search_members(text) TO anon, authenticated;
