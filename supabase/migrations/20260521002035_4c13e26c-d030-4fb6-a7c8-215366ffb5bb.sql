
CREATE TABLE IF NOT EXISTS public.email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_api_key text,
  resend_from text,
  resend_enabled boolean NOT NULL DEFAULT false,
  smtp_host text,
  smtp_port integer DEFAULT 587,
  smtp_user text,
  smtp_password text,
  smtp_from text,
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_enabled boolean NOT NULL DEFAULT false,
  primary_provider text NOT NULL DEFAULT 'resend',
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email settings" ON public.email_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.email_settings (singleton) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default templates
INSERT INTO public.email_templates (key, name, subject, description, blocks) VALUES
  ('welcome', 'Welcome + Temporary Password', 'Welcome to FAGE Ghana — your account is ready',
   'Sent after a new member''s payment is confirmed.',
   '[
     {"id":"b1","type":"heading","text":"Welcome to FAGE, {{name}}!","align":"center"},
     {"id":"b2","type":"text","text":"Your {{tier}} membership payment has been confirmed. Your account is now active."},
     {"id":"b3","type":"text","text":"Your member ID: <strong>{{member_id}}</strong>"},
     {"id":"b4","type":"text","text":"Temporary password: <strong>{{temp_password}}</strong><br/>Please sign in and change it immediately."},
     {"id":"b5","type":"button","text":"Sign in to dashboard","url":"{{login_url}}"},
     {"id":"b6","type":"text","text":"If you have any questions, simply reply to this email."}
   ]'::jsonb),
  ('receipt', 'Payment Receipt', 'Your FAGE payment receipt — {{reference}}',
   'Sent when a new member payment is confirmed.',
   '[
     {"id":"b1","type":"heading","text":"Payment received","align":"center"},
     {"id":"b2","type":"text","text":"Hi {{name}}, we have received your payment of <strong>{{currency}} {{amount}}</strong> for the {{tier}} membership."},
     {"id":"b3","type":"text","text":"Reference: {{reference}}<br/>Date: {{date}}"},
     {"id":"b4","type":"button","text":"View receipt","url":"{{receipt_url}}"}
   ]'::jsonb),
  ('renewal', 'Renewal Receipt', 'Your FAGE membership has been renewed',
   'Sent when a member renews their subscription.',
   '[
     {"id":"b1","type":"heading","text":"Renewal confirmed","align":"center"},
     {"id":"b2","type":"text","text":"Thank you {{name}}. Your membership has been renewed until <strong>{{expiry}}</strong>."},
     {"id":"b3","type":"text","text":"Reference: {{reference}}<br/>Amount: {{currency}} {{amount}}"},
     {"id":"b4","type":"button","text":"Go to dashboard","url":"{{dashboard_url}}"}
   ]'::jsonb),
  ('application_received', 'Application Received', 'We received your FAGE membership application',
   'Sent after a public form is submitted.',
   '[
     {"id":"b1","type":"heading","text":"Application received","align":"center"},
     {"id":"b2","type":"text","text":"Thank you {{name}}, we have received your application for the {{tier}} membership tier. Our team will review and get back to you shortly."},
     {"id":"b3","type":"text","text":"If you have already paid, your account will be activated within 2 business days."}
   ]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  template_key text,
  provider text NOT NULL,
  status text NOT NULL,
  error text,
  fallback_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view email log" ON public.email_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
