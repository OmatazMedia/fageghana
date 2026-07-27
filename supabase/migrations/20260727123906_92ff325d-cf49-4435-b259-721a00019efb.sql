CREATE TABLE public.chatbot_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('reply','session')),
  helpful boolean,
  rating int CHECK (rating BETWEEN 1 AND 5),
  comment text,
  question text,
  bot_reply text,
  transcript jsonb,
  session_id text NOT NULL,
  user_id uuid,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.chatbot_feedback TO anon, authenticated;
GRANT SELECT ON public.chatbot_feedback TO authenticated;
GRANT ALL ON public.chatbot_feedback TO service_role;

ALTER TABLE public.chatbot_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
  ON public.chatbot_feedback FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff and admins can read feedback"
  ON public.chatbot_feedback FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

CREATE INDEX idx_chatbot_feedback_created_at ON public.chatbot_feedback (created_at DESC);
CREATE INDEX idx_chatbot_feedback_kind ON public.chatbot_feedback (kind);