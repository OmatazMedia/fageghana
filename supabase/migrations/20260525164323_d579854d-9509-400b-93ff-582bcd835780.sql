
-- 1. Events & RSVPs ---------------------------------------------------------
ALTER TABLE public.event_rsvps
  ADD CONSTRAINT event_rsvps_user_activity_unique UNIQUE (user_id, activity_id);

CREATE POLICY "Admins view all rsvps"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Trade Opportunity Interests --------------------------------------------
CREATE TABLE public.trade_opportunity_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.trade_opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, user_id)
);

ALTER TABLE public.trade_opportunity_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members insert own interests"
  ON public.trade_opportunity_interests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members view own interests"
  ON public.trade_opportunity_interests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members delete own interests"
  ON public.trade_opportunity_interests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage interests"
  ON public.trade_opportunity_interests FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Member Directory --------------------------------------------------------
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS directory_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS directory_bio text,
  ADD COLUMN IF NOT EXISTS directory_website text,
  ADD COLUMN IF NOT EXISTS directory_logo_url text;

CREATE OR REPLACE VIEW public.member_directory
WITH (security_invoker = true) AS
SELECT
  mp.user_id,
  mp.member_id,
  mp.company_name,
  mp.contact_name,
  mp.industry,
  mp.country,
  mp.products_exported,
  mp.directory_bio,
  mp.directory_website,
  mp.directory_logo_url,
  mp.tier
FROM public.member_profiles mp
WHERE mp.status = 'approved'
  AND mp.directory_visible = true;

CREATE POLICY "Members view directory rows"
  ON public.member_profiles FOR SELECT
  TO authenticated
  USING (status = 'approved' AND directory_visible = true);

GRANT SELECT ON public.member_directory TO authenticated;

-- 4. Export Readiness Tracker ------------------------------------------------
CREATE TABLE public.readiness_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'General',
  label text NOT NULL,
  description text,
  weight integer NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.readiness_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated view active items"
  ON public.readiness_checklist_items FOR SELECT
  TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage checklist items"
  ON public.readiness_checklist_items FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_readiness_items_updated_at
  BEFORE UPDATE ON public.readiness_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.readiness_status AS ENUM ('not_started', 'in_progress', 'complete');

CREATE TABLE public.member_readiness_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.readiness_checklist_items(id) ON DELETE CASCADE,
  status public.readiness_status NOT NULL DEFAULT 'not_started',
  evidence_doc_id uuid REFERENCES public.member_documents(id) ON DELETE SET NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE public.member_readiness_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own responses"
  ON public.member_readiness_responses FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all responses"
  ON public.member_readiness_responses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_readiness_responses_updated_at
  BEFORE UPDATE ON public.member_readiness_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.get_readiness_score(_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH items AS (
    SELECT id, weight FROM public.readiness_checklist_items WHERE active = true
  ),
  total AS (
    SELECT COALESCE(SUM(weight), 0)::numeric AS w FROM items
  ),
  earned AS (
    SELECT COALESCE(SUM(
      CASE r.status
        WHEN 'complete' THEN i.weight
        WHEN 'in_progress' THEN i.weight * 0.5
        ELSE 0
      END
    ), 0)::numeric AS w
    FROM items i
    LEFT JOIN public.member_readiness_responses r
      ON r.item_id = i.id AND r.user_id = _user_id
  )
  SELECT CASE WHEN (SELECT w FROM total) = 0 THEN 0
              ELSE ROUND(((SELECT w FROM earned) / (SELECT w FROM total)) * 100, 1)
         END;
$$;
