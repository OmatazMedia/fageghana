
-- 1) payment_gateways: remove public access; expose safe view
DROP POLICY IF EXISTS "Anyone view enabled gateways" ON public.payment_gateways;

CREATE OR REPLACE VIEW public.payment_gateways_public
WITH (security_invoker = on) AS
SELECT id, name, provider, enabled, display_order, bank_details, created_at, updated_at
FROM public.payment_gateways
WHERE enabled = true;

-- Allow anyone to read the safe view (secret config excluded)
CREATE POLICY "Public read enabled gateways safe"
  ON public.payment_gateways FOR SELECT
  TO anon, authenticated
  USING (false);  -- direct base table: blocked; view uses invoker, also blocked unless admin

-- Actually we want the view to work for everyone. Drop above misleading policy and use a permissive base policy guarded to non-sensitive columns is not possible.
DROP POLICY IF EXISTS "Public read enabled gateways safe" ON public.payment_gateways;

-- Use a SECURITY DEFINER function to fetch enabled gateways without secrets
CREATE OR REPLACE FUNCTION public.list_enabled_gateways()
RETURNS TABLE (
  id uuid,
  name text,
  provider text,
  enabled boolean,
  display_order integer,
  bank_details jsonb,
  public_key text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, provider, enabled, display_order, bank_details,
         (config->>'public_key')::text AS public_key
  FROM public.payment_gateways
  WHERE enabled = true
  ORDER BY display_order;
$$;

REVOKE ALL ON FUNCTION public.list_enabled_gateways() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_enabled_gateways() TO anon, authenticated;

-- 2) certificates: remove broad public access, use RPC for verification
DROP POLICY IF EXISTS "Anyone can verify cert" ON public.certificates;

CREATE POLICY "Members view own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.verify_certificate(_code text)
RETURNS TABLE (
  full_name text,
  member_id text,
  tier membership_tier,
  issued_at timestamptz,
  expires_at timestamptz,
  revoked boolean,
  verification_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT full_name, member_id, tier, issued_at, expires_at, revoked, verification_code
  FROM public.certificates
  WHERE verification_code = _code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon, authenticated;

-- 3) pending_applications: replace blanket read with token-scoped RPC
DROP POLICY IF EXISTS "Read pending application by token" ON public.pending_applications;

CREATE OR REPLACE FUNCTION public.get_pending_application(_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  company_name text,
  tier text,
  plan_id uuid,
  status text,
  claim_token uuid,
  user_id uuid,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, full_name, phone, company_name, tier, plan_id, status,
         claim_token, user_id, expires_at, created_at
  FROM public.pending_applications
  WHERE claim_token = _token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pending_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_application(uuid) TO anon, authenticated;

-- 4) Lock down dangerous admin SECURITY DEFINER helpers (service-role only)
REVOKE ALL ON FUNCTION public.admin_exec_sql(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_tables() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_enums() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_functions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_policies() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_sequences() FROM PUBLIC, anon, authenticated;
