
-- Plans: toggle, ordering, custom slug
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS name text;

-- Backfill slug + name from tier where missing
UPDATE public.subscription_plans
   SET slug = COALESCE(slug, tier::text),
       name = COALESCE(name, initcap(tier::text) || ' Membership');

-- Make slug unique going forward
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_plans_slug_key'
  ) THEN
    ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_slug_key UNIQUE (slug);
  END IF;
END $$;

-- Anonymous pending applications
CREATE TABLE IF NOT EXISTS public.pending_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  tier text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  company_name text NOT NULL DEFAULT '',
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  status text NOT NULL DEFAULT 'awaiting_payment',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_pending_applications_token ON public.pending_applications(claim_token);
CREATE INDEX IF NOT EXISTS idx_pending_applications_email ON public.pending_applications(email);

ALTER TABLE public.pending_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create pending applications" ON public.pending_applications;
CREATE POLICY "Anyone can create pending applications"
  ON public.pending_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(full_name)) > 0
    AND length(trim(email)) > 0
    AND length(trim(phone)) > 0
    AND status = 'awaiting_payment'
  );

DROP POLICY IF EXISTS "Read pending application by token" ON public.pending_applications;
CREATE POLICY "Read pending application by token"
  ON public.pending_applications FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage pending applications" ON public.pending_applications;
CREATE POLICY "Admins manage pending applications"
  ON public.pending_applications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Mark renewals on payment_submissions
ALTER TABLE public.payment_submissions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS pending_application_id uuid REFERENCES public.pending_applications(id) ON DELETE SET NULL;
