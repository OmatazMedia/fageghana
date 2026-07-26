
-- Chatbot knowledge base
CREATE TABLE public.chatbot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  content text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chatbot_knowledge TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chatbot_knowledge TO authenticated;
GRANT ALL ON public.chatbot_knowledge TO service_role;
ALTER TABLE public.chatbot_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chatbot_knowledge read enabled" ON public.chatbot_knowledge
  FOR SELECT TO anon, authenticated USING (enabled OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role));
CREATE POLICY "chatbot_knowledge admin manage" ON public.chatbot_knowledge
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role));
CREATE TRIGGER chatbot_knowledge_touch_updated_at BEFORE UPDATE ON public.chatbot_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.chatbot_knowledge (section, content, display_order) VALUES
('Persona & Tone', 'You are the FAGE Assistant — a helpful chatbot for the Federation of Associations of Ghanaian Exporters (FAGE). Answer questions using ONLY the facts below. Be warm, concise, and use markdown (short lists, bold labels).', 10),
('About FAGE', 'FAGE is Ghana''s apex private-sector body representing exporters. It advocates for members, delivers trade-readiness support, connects buyers with Ghanaian exporters, and organises trade missions, capacity building, and market intelligence.', 20),
('Membership Tiers', '- **Associate** — for start-ups and small exporters. Basic directory listing, events access, newsletters.
- **Standard** — for growing exporters. All Associate benefits plus trade opportunities, verified certificate, priority events.
- **Corporate** — for established exporters. All Standard benefits plus premium directory placement, mission delegations, advisory access.', 30),
('Services', '- Export readiness assessment and mentoring
- Trade missions and B2B matchmaking
- Certificates of membership and verification
- Market intelligence and trade opportunities
- Advocacy with government and trade partners
- FAGE Academy — training in exporting, standards, and market entry
- Sector desks including clothing & textile products', 40),
('Contact', '- Website: fageghana.org
- Email: membership@fageghana.org
- WhatsApp: +233 53 517 0780
- Office: Accra, Ghana', 50),
('Escalation rule', 'If the question is outside these topics, requires personal account access, involves a complaint, or you are not confident of the answer, reply with exactly:
ESCALATE: <one-line summary of what the user needs>
Do not invent facts. Do not answer legal, medical, financial-advice, or private-account questions.', 90);

-- Backup upload results per destination
CREATE TABLE public.backup_run_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.backup_runs(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES public.backup_destinations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  ok boolean NOT NULL,
  message text,
  external_id text,
  url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_run_uploads TO authenticated;
GRANT ALL ON public.backup_run_uploads TO service_role;
ALTER TABLE public.backup_run_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_run_uploads admin manage" ON public.backup_run_uploads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role));
CREATE INDEX idx_backup_run_uploads_run ON public.backup_run_uploads(run_id);
