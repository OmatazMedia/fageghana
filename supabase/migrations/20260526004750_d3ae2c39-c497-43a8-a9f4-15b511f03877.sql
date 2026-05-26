
DROP VIEW IF EXISTS public.member_invoices;
CREATE VIEW public.member_invoices
WITH (security_invoker = on) AS
SELECT ps.id, ps.user_id, ps.amount, ps.currency, ps.status, ps.reference,
       ps.method, ps.kind, ps.duration_months, ps.confirmed_at, ps.created_at,
       mp.company_name, mp.contact_name, mp.member_id, mp.tier,
       pg.name AS gateway_name
  FROM public.payment_submissions ps
  LEFT JOIN public.member_profiles mp ON mp.user_id = ps.user_id
  LEFT JOIN public.payment_gateways pg ON pg.id = ps.gateway_id
 WHERE ps.status = 'confirmed'::payment_status;

DROP POLICY IF EXISTS "Anyone view active templates" ON public.certificate_templates;
CREATE POLICY "Authenticated view active templates"
ON public.certificate_templates FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Block anon select pending_applications"
ON public.pending_applications AS RESTRICTIVE FOR SELECT
TO anon
USING (false);

DROP POLICY IF EXISTS "Anyone can remove own reaction" ON public.blog_reactions;

CREATE OR REPLACE FUNCTION public.delete_blog_reaction(
  p_news_id uuid, p_session_id text, p_emoji text
) RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  DELETE FROM public.blog_reactions
  WHERE news_id = p_news_id
    AND session_id = p_session_id
    AND emoji = p_emoji
    AND length(p_session_id) BETWEEN 8 AND 64;
$$;

GRANT EXECUTE ON FUNCTION public.delete_blog_reaction(uuid, text, text) TO anon, authenticated;
