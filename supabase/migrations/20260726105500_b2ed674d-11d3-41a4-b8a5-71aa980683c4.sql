
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  detail text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS activity_log_user_created_idx
  ON public.activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_event_created_idx
  ON public.activity_log(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_idx
  ON public.activity_log(created_at DESC);

CREATE POLICY "Users view own activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins view all activity"
  ON public.activity_log FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  );

CREATE POLICY "Users insert own activity"
  ON public.activity_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
