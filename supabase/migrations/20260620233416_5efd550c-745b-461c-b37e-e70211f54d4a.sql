
-- =========================================================
-- 1. directory_entries: member ownership + approval workflow
-- =========================================================
ALTER TABLE public.directory_entries
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'directory_entries_status_chk') THEN
    ALTER TABLE public.directory_entries
      ADD CONSTRAINT directory_entries_status_chk
      CHECK (status IN ('draft','pending','approved','rejected','suspended'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS directory_entries_one_per_member
  ON public.directory_entries(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS directory_entries_status_idx ON public.directory_entries(status);

-- Members: read & edit their own row
DROP POLICY IF EXISTS "Members read own directory entry" ON public.directory_entries;
CREATE POLICY "Members read own directory entry"
  ON public.directory_entries FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Members insert own directory entry" ON public.directory_entries;
CREATE POLICY "Members insert own directory entry"
  ON public.directory_entries FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','pending'));

DROP POLICY IF EXISTS "Members update own directory entry" ON public.directory_entries;
CREATE POLICY "Members update own directory entry"
  ON public.directory_entries FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Trigger: non-admins cannot escalate status beyond draft/pending; reviewer fields locked to admin
CREATE OR REPLACE FUNCTION public.directory_entries_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  BEGIN
    is_admin := public.has_role(auth.uid(), 'admin'::app_role);
  EXCEPTION WHEN OTHERS THEN is_admin := false; END;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admin writes: force safe status + clear review fields
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft','pending') THEN NEW.status := 'pending'; END IF;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.review_notes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status NOT IN ('draft','pending') THEN NEW.status := OLD.status; END IF;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.review_notes := OLD.review_notes;
    -- Member cannot reassign ownership
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS directory_entries_guard_trg ON public.directory_entries;
CREATE TRIGGER directory_entries_guard_trg
  BEFORE INSERT OR UPDATE ON public.directory_entries
  FOR EACH ROW EXECUTE FUNCTION public.directory_entries_guard();

-- Refresh the public view to enforce status + subscription
DROP VIEW IF EXISTS public.directory_entries_public;
CREATE VIEW public.directory_entries_public
WITH (security_invoker = true) AS
SELECT id, entry_type, slug, company_name, short_description, long_description,
       mission, vision, services, products, executives, director_name,
       website, physical_address, postal_address, country, region,
       logo_url, cover_image_url, category, featured, display_order,
       custom_fields, created_at, updated_at
FROM public.directory_entries
WHERE published = true
  AND status = 'approved'
  AND (
    user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = directory_entries.user_id
        AND mp.subscription_expiry IS NOT NULL
        AND mp.subscription_expiry > now()
    )
  );

GRANT SELECT ON public.directory_entries_public TO anon, authenticated;

-- RPC: member submits their own listing (creates or updates), gated on active subscription
CREATE OR REPLACE FUNCTION public.submit_my_directory_entry(_payload jsonb, _submit boolean DEFAULT true)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  active boolean;
  existing_id uuid;
  new_status text;
  base_slug text;
  final_slug text;
  i int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT (subscription_expiry IS NOT NULL AND subscription_expiry > now())
    INTO active FROM public.member_profiles WHERE user_id = uid;
  IF NOT COALESCE(active, false) THEN
    RAISE EXCEPTION 'Active subscription required to publish a directory listing';
  END IF;

  new_status := CASE WHEN _submit THEN 'pending' ELSE 'draft' END;

  SELECT id INTO existing_id FROM public.directory_entries WHERE user_id = uid;

  -- slug: prefer supplied, else slugify company_name, ensure unique
  base_slug := COALESCE(NULLIF(_payload->>'slug',''),
                        lower(regexp_replace(COALESCE(_payload->>'company_name',''), '[^a-zA-Z0-9]+', '-', 'g')));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'member-' || substr(uid::text,1,8); END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.directory_entries WHERE slug = final_slug AND (existing_id IS NULL OR id <> existing_id)) LOOP
    i := i + 1;
    final_slug := base_slug || '-' || i;
  END LOOP;

  IF existing_id IS NULL THEN
    INSERT INTO public.directory_entries (
      user_id, entry_type, slug, company_name, short_description, long_description,
      mission, vision, services, products, executives, director_name,
      contact_name, phone, email, website, physical_address, postal_address,
      country, region, logo_url, cover_image_url, category, custom_fields,
      status, submitted_at, published
    ) VALUES (
      uid,
      COALESCE(_payload->>'entry_type','corporate'),
      final_slug,
      COALESCE(_payload->>'company_name',''),
      _payload->>'short_description',
      _payload->>'long_description',
      _payload->>'mission',
      _payload->>'vision',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'services')), '{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'products')), '{}'),
      COALESCE(_payload->'executives','[]'::jsonb),
      _payload->>'director_name',
      _payload->>'contact_name',
      _payload->>'phone',
      _payload->>'email',
      _payload->>'website',
      _payload->>'physical_address',
      _payload->>'postal_address',
      COALESCE(_payload->>'country','Ghana'),
      _payload->>'region',
      _payload->>'logo_url',
      _payload->>'cover_image_url',
      _payload->>'category',
      COALESCE(_payload->'custom_fields','{}'::jsonb),
      new_status,
      CASE WHEN _submit THEN now() ELSE NULL END,
      true
    ) RETURNING id INTO existing_id;
  ELSE
    UPDATE public.directory_entries SET
      entry_type        = COALESCE(_payload->>'entry_type', entry_type),
      slug              = final_slug,
      company_name      = COALESCE(_payload->>'company_name', company_name),
      short_description = _payload->>'short_description',
      long_description  = _payload->>'long_description',
      mission           = _payload->>'mission',
      vision            = _payload->>'vision',
      services          = COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'services')), '{}'),
      products          = COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'products')), '{}'),
      executives        = COALESCE(_payload->'executives','[]'::jsonb),
      director_name     = _payload->>'director_name',
      contact_name      = _payload->>'contact_name',
      phone             = _payload->>'phone',
      email             = _payload->>'email',
      website           = _payload->>'website',
      physical_address  = _payload->>'physical_address',
      postal_address    = _payload->>'postal_address',
      country           = COALESCE(_payload->>'country', country),
      region            = _payload->>'region',
      logo_url          = _payload->>'logo_url',
      cover_image_url   = _payload->>'cover_image_url',
      category          = _payload->>'category',
      custom_fields     = COALESCE(_payload->'custom_fields','{}'::jsonb),
      status            = new_status,
      submitted_at      = CASE WHEN _submit THEN now() ELSE submitted_at END,
      updated_at        = now()
    WHERE id = existing_id;
  END IF;

  RETURN existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_my_directory_entry(jsonb, boolean) TO authenticated;

-- Admin review RPC
CREATE OR REPLACE FUNCTION public.admin_review_directory_entry(_id uuid, _action text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role)
     AND NOT public.has_role(auth.uid(),'staff'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _action NOT IN ('approve','reject','withdraw','suspend') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;
  UPDATE public.directory_entries
  SET status = CASE _action
                 WHEN 'approve'  THEN 'approved'
                 WHEN 'reject'   THEN 'rejected'
                 WHEN 'withdraw' THEN 'pending'
                 WHEN 'suspend'  THEN 'suspended'
               END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      review_notes = _notes
  WHERE id = _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_review_directory_entry(uuid, text, text) TO authenticated;

-- =========================================================
-- 2. membership_resources table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.membership_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text,
  description text,
  body text,
  cover_image_url text,
  file_url text,
  external_url text,
  min_tier text,
  published boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.membership_resources TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.membership_resources TO authenticated;
GRANT ALL ON public.membership_resources TO service_role;

ALTER TABLE public.membership_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published resources" ON public.membership_resources;
CREATE POLICY "Anyone can read published resources"
  ON public.membership_resources FOR SELECT
  USING (published = true OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

DROP POLICY IF EXISTS "Admins manage resources" ON public.membership_resources;
CREATE POLICY "Admins manage resources"
  ON public.membership_resources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'staff'::app_role));

DROP TRIGGER IF EXISTS membership_resources_touch ON public.membership_resources;
CREATE TRIGGER membership_resources_touch
  BEFORE UPDATE ON public.membership_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
