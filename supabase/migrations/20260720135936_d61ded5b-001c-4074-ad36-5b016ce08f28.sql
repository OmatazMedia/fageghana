
-- 1) New app roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ceo';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';

-- 2) Member ID counters
CREATE TABLE IF NOT EXISTS public.member_id_counters (
  year_abbrev text PRIMARY KEY,
  next_seq int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_id_counters TO authenticated;
GRANT ALL ON public.member_id_counters TO service_role;
ALTER TABLE public.member_id_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read counters" ON public.member_id_counters;
CREATE POLICY "read counters" ON public.member_id_counters FOR SELECT TO authenticated USING (true);

-- 3) Subscription plans: id abbreviation (e.g. AS, CR, SB)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS id_abbreviation text;

-- backfill sensible defaults if tier column exists
UPDATE public.subscription_plans SET id_abbreviation = CASE
  WHEN lower(coalesce(tier::text,'')) LIKE 'assoc%' THEN 'AS'
  WHEN lower(coalesce(tier::text,'')) LIKE 'corp%'  THEN 'CR'
  ELSE 'SB'
END
WHERE id_abbreviation IS NULL;

-- 4) Structured member ID generator (FAGE/AS/YY/00001)
CREATE OR REPLACE FUNCTION public.generate_structured_member_id(_abbrev text, _year int DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yy int := COALESCE(_year, extract(year from now())::int) % 100;
  key text := yy::text || '-' || upper(_abbrev);
  seq int;
BEGIN
  INSERT INTO public.member_id_counters(year_abbrev, next_seq)
  VALUES (key, 2)
  ON CONFLICT (year_abbrev) DO UPDATE
    SET next_seq = public.member_id_counters.next_seq + 1,
        updated_at = now()
  RETURNING (next_seq - 1) INTO seq;

  RETURN 'FAGE/' || upper(_abbrev) || '/' || lpad(yy::text,2,'0') || '/' || lpad(seq::text,5,'0');
END; $$;

-- 5) Activity log extensions
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS event_type text;

CREATE INDEX IF NOT EXISTS activities_event_type_idx ON public.activities(event_type);
CREATE INDEX IF NOT EXISTS activities_created_at_idx ON public.activities(created_at DESC);

-- 6) Backup runs: storage path
ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS storage_path text;

-- 7) Readiness ordering
ALTER TABLE public.readiness_checklist_items
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;

-- 8) Ensure user_roles allows admin/superadmin/developer to insert/update
-- (kept permissive for admin flows already in place)
