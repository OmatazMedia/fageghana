CREATE TABLE public.user_email_mfa (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  enabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_email_mfa TO authenticated;
GRANT ALL ON public.user_email_mfa TO service_role;

ALTER TABLE public.user_email_mfa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own email MFA setting"
  ON public.user_email_mfa FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER user_email_mfa_touch
  BEFORE UPDATE ON public.user_email_mfa
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One-time codes: fully private, service role only.
CREATE TABLE public.email_otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'mfa',
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX email_otp_codes_user_idx ON public.email_otp_codes (user_id, purpose, created_at DESC);

GRANT ALL ON public.email_otp_codes TO service_role;

ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;
-- No policies: unreachable via the Data API by anon/authenticated by design.