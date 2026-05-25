
-- trade_opportunities
CREATE TABLE IF NOT EXISTS public.trade_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  source text,
  source_url text UNIQUE,
  category text,
  country text,
  deadline date,
  posted_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active opportunities"
  ON public.trade_opportunities FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins manage trade opportunities"
  ON public.trade_opportunities FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_trade_opp_updated
  BEFORE UPDATE ON public.trade_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_trade_opp_active ON public.trade_opportunities(is_active, posted_at DESC);

-- member_email_preferences
CREATE TABLE IF NOT EXISTS public.member_email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  newsletters boolean NOT NULL DEFAULT true,
  event_alerts boolean NOT NULL DEFAULT true,
  trade_notices boolean NOT NULL DEFAULT true,
  payment_reminders boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own email prefs"
  ON public.member_email_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members insert own email prefs"
  ON public.member_email_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members update own email prefs"
  ON public.member_email_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all email prefs"
  ON public.member_email_preferences FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_email_prefs_updated
  BEFORE UPDATE ON public.member_email_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
