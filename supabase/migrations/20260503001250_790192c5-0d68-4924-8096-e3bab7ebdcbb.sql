
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS member_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_start timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expiry timestamptz;

CREATE SEQUENCE IF NOT EXISTS public.member_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_member_id(_tier membership_tier)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prefix text; yr text; num bigint;
BEGIN
  prefix := CASE WHEN _tier = 'associate' THEN 'ASSOC'
                 WHEN _tier = 'corporate' THEN 'CORP'
                 ELSE 'STD' END;
  yr := to_char(now(),'YY');
  num := nextval('public.member_id_seq');
  RETURN 'FAGE-' || prefix || '-' || yr || lpad(num::text, 6, '0');
END; $$;
REVOKE EXECUTE ON FUNCTION public.generate_member_id(membership_tier) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  bank_details jsonb,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view enabled gateways" ON public.payment_gateways FOR SELECT USING (enabled = true);
CREATE POLICY "Admins manage gateways" ON public.payment_gateways FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier membership_tier NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  duration_months int NOT NULL DEFAULT 12,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view plans" ON public.subscription_plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.subscription_plans(tier, amount, duration_months, description)
VALUES ('associate', 500, 12, 'Associate annual membership'),
       ('standard', 1500, 12, 'Standard annual membership'),
       ('corporate', 3000, 12, 'Corporate annual membership')
ON CONFLICT (tier) DO NOTHING;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending','confirmed','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  gateway_id uuid REFERENCES public.payment_gateways(id) ON DELETE SET NULL,
  method text NOT NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  reference text,
  proof_url text,
  member_message text,
  status payment_status NOT NULL DEFAULT 'pending',
  admin_notes text,
  confirmed_by uuid,
  confirmed_at timestamptz,
  duration_months int NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own payments" ON public.payment_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members create own payments" ON public.payment_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all payments" ON public.payment_submissions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update payments" ON public.payment_submissions FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete payments" ON public.payment_submissions FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier membership_tier NOT NULL,
  image_url text NOT NULL,
  signature_url text,
  authorized_name text DEFAULT 'FAGE President',
  field_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view active templates" ON public.certificate_templates FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage templates" ON public.certificate_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
  member_id text NOT NULL,
  full_name text NOT NULL,
  tier membership_tier NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verification_code text NOT NULL UNIQUE,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can verify cert" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Admins manage certs" ON public.certificates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own or broadcast" ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Users mark own read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DO $$ BEGIN
  CREATE TYPE ticket_status AS ENUM ('open','pending','resolved','closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  status ticket_status NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own tickets or admin" ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Members create tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update tickets owner or admin" ON public.support_tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete tickets" ON public.support_tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View ticket msgs owner or admin" ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR has_role(auth.uid(),'admin'))));
CREATE POLICY "Insert ticket msgs owner or admin" ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR has_role(auth.uid(),'admin'))));

CREATE TRIGGER set_payment_gateways_updated BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_payment_submissions_updated BEFORE UPDATE ON public.payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_certificate_templates_updated BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs','payment-proofs', false),
       ('certificate-assets','certificate-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members upload own proof" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Members read own proof or admin" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin'))
);
CREATE POLICY "Admins manage cert assets" ON storage.objects FOR ALL TO authenticated USING (
  bucket_id = 'certificate-assets' AND has_role(auth.uid(),'admin')
) WITH CHECK (
  bucket_id = 'certificate-assets' AND has_role(auth.uid(),'admin')
);
CREATE POLICY "Anyone read cert assets" ON storage.objects FOR SELECT USING (bucket_id = 'certificate-assets');
