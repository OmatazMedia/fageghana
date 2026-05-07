
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS application_form_pdf_url text,
  ADD COLUMN IF NOT EXISTS post_download_message text DEFAULT 'Thanks for downloading the FAGE membership form. Complete all sections, attach your proof of payment, and email everything to membership@fageghana.org. Our team will verify and activate your account within 2 business days.',
  ADD COLUMN IF NOT EXISTS bank_deposit_email text DEFAULT 'membership@fageghana.org';

UPDATE public.subscription_plans SET post_download_message = 'Thanks for downloading the FAGE membership form. Complete all sections, attach your proof of payment, and email everything to membership@fageghana.org. Our team will verify and activate your account within 2 business days.' WHERE post_download_message IS NULL;
UPDATE public.subscription_plans SET bank_deposit_email = 'membership@fageghana.org' WHERE bank_deposit_email IS NULL;

CREATE TABLE IF NOT EXISTS public.application_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier membership_tier NOT NULL UNIQUE,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.application_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view published forms" ON public.application_forms FOR SELECT USING (published = true);
CREATE POLICY "Admins manage forms" ON public.application_forms FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_application_forms_updated_at BEFORE UPDATE ON public.application_forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.application_forms (tier, schema) VALUES
  ('associate', '[{"id":"f1","type":"text","label":"Company Name","name":"company_name","required":true},{"id":"f2","type":"text","label":"Contact Person","name":"contact_name","required":true},{"id":"f3","type":"email","label":"Email","name":"email","required":true},{"id":"f4","type":"phone","label":"Phone","name":"phone","required":true},{"id":"f5","type":"text","label":"Industry","name":"industry"},{"id":"f6","type":"paragraph","label":"Products you export","name":"products"}]'::jsonb),
  ('standard', '[{"id":"f1","type":"text","label":"Company Name","name":"company_name","required":true},{"id":"f2","type":"text","label":"Contact Person","name":"contact_name","required":true},{"id":"f3","type":"email","label":"Email","name":"email","required":true},{"id":"f4","type":"phone","label":"Phone","name":"phone","required":true}]'::jsonb),
  ('corporate', '[{"id":"f1","type":"text","label":"Company Name","name":"company_name","required":true},{"id":"f2","type":"text","label":"Contact Person","name":"contact_name","required":true},{"id":"f3","type":"email","label":"Email","name":"email","required":true},{"id":"f4","type":"phone","label":"Phone","name":"phone","required":true},{"id":"f5","type":"number","label":"Years in Operation","name":"years"},{"id":"f6","type":"paragraph","label":"Export markets","name":"markets"}]'::jsonb)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.application_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier membership_tier NOT NULL,
  payment_id uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status application_status NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.application_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own submissions" ON public.application_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members create own submissions" ON public.application_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage submissions" ON public.application_submissions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_application_submissions_updated_at BEFORE UPDATE ON public.application_submissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
