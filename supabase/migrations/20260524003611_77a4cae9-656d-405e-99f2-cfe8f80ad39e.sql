-- Contact messages table
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  source text NOT NULL DEFAULT 'contact_page',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit contact message"
ON public.contact_messages FOR INSERT TO anon, authenticated
WITH CHECK (
  length(trim(name)) > 0 AND length(trim(name)) <= 200
  AND length(trim(email)) > 0 AND length(trim(email)) <= 320
  AND length(trim(message)) > 0 AND length(message) <= 5000
  AND (subject IS NULL OR length(subject) <= 300)
  AND (phone IS NULL OR length(phone) <= 50)
  AND source IN ('contact_page','chat_widget')
);

CREATE POLICY "Admins view contact messages"
ON public.contact_messages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete contact messages"
ON public.contact_messages FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Blog reactions
CREATE TABLE public.blog_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL,
  emoji text NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (news_id, session_id, emoji)
);
CREATE INDEX idx_blog_reactions_news ON public.blog_reactions(news_id);
ALTER TABLE public.blog_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions"
ON public.blog_reactions FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Anyone can add reaction"
ON public.blog_reactions FOR INSERT TO anon, authenticated
WITH CHECK (
  emoji IN ('👍','❤️','🎉','😮','👏')
  AND length(session_id) BETWEEN 8 AND 64
);

CREATE POLICY "Anyone can remove own reaction"
ON public.blog_reactions FOR DELETE TO anon, authenticated
USING (true);