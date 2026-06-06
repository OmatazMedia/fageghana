
-- 1. Restrict certificate_templates SELECT to admins only; expose render data via SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Authenticated view active templates" ON public.certificate_templates;

CREATE OR REPLACE FUNCTION public.get_certificate_with_template(_cert_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.certificates%ROWTYPE;
  t public.certificate_templates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.certificates WHERE id = _cert_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF c.template_id IS NOT NULL THEN
    SELECT * INTO t FROM public.certificate_templates WHERE id = c.template_id;
  END IF;
  IF t.id IS NULL THEN
    SELECT * INTO t FROM public.certificate_templates WHERE tier = c.tier AND is_active = true LIMIT 1;
  END IF;
  RETURN jsonb_build_object('certificate', to_jsonb(c), 'template', to_jsonb(t));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_certificate_with_template(uuid) TO authenticated;

-- Verification RPC: return cert + minimal template render fields for the public verify page.
CREATE OR REPLACE FUNCTION public.verify_certificate_with_template(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.certificates%ROWTYPE;
  t public.certificate_templates%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.certificates WHERE verification_code = _code;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.template_id IS NOT NULL THEN
    SELECT * INTO t FROM public.certificate_templates WHERE id = c.template_id;
  END IF;
  IF t.id IS NULL THEN
    SELECT * INTO t FROM public.certificate_templates WHERE tier = c.tier AND is_active = true LIMIT 1;
  END IF;
  RETURN jsonb_build_object(
    'certificate', jsonb_build_object(
      'full_name', c.full_name,
      'member_id', c.member_id,
      'tier', c.tier,
      'issued_at', c.issued_at,
      'expires_at', c.expires_at,
      'revoked', c.revoked,
      'verification_code', c.verification_code,
      'template_id', c.template_id
    ),
    'template', CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object(
      'field_positions', t.field_positions
    ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate_with_template(text) TO anon, authenticated;

-- 2. Hide contact PII (email, phone, contact_name, executives) in directory_entries from anon.
-- Replace the public SELECT policy with one that's still public, but expose a safe view for anon.
DROP POLICY IF EXISTS "Anyone can view published directory entries" ON public.directory_entries;

-- Authenticated users can still see full published rows.
CREATE POLICY "Authenticated view published directory entries"
ON public.directory_entries FOR SELECT TO authenticated
USING (published = true);

-- Public-safe view excludes contact PII.
CREATE OR REPLACE VIEW public.directory_entries_public
WITH (security_invoker = on) AS
SELECT id, entry_type, slug, company_name, short_description, long_description,
       mission, vision, services, products, director_name,
       website, physical_address, postal_address, country, region,
       logo_url, cover_image_url, category, featured, display_order,
       published, created_at, updated_at
FROM public.directory_entries
WHERE published = true;

-- Anon needs SELECT on the underlying table for the view (security_invoker), but only non-PII cols.
CREATE POLICY "Anon view published directory entries"
ON public.directory_entries FOR SELECT TO anon
USING (published = true);

-- Revoke the PII columns from anon at column-level so even direct table queries can't leak them.
REVOKE SELECT ON public.directory_entries FROM anon;
GRANT SELECT (id, entry_type, slug, company_name, short_description, long_description,
              mission, vision, services, products, director_name,
              website, physical_address, postal_address, country, region,
              logo_url, cover_image_url, category, featured, display_order,
              published, created_at, updated_at)
ON public.directory_entries TO anon;

GRANT SELECT ON public.directory_entries_public TO anon, authenticated;
