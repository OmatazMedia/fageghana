-- 1. Dedupe user_roles: keep the highest-privilege role per user
WITH ranked AS (
  SELECT id, user_id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY CASE role::text
             WHEN 'developer' THEN 1
             WHEN 'superadmin' THEN 2
             WHEN 'admin' THEN 3
             WHEN 'staff' THEN 4
             WHEN 'coordinator' THEN 5
             WHEN 'finance' THEN 6
             WHEN 'ceo' THEN 7
             WHEN 'moderator' THEN 8
             ELSE 9 END, created_at
         ) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_id_unique ON public.user_roles(user_id);

-- 2. Security settings singleton (inactivity auto sign-out)
CREATE TABLE IF NOT EXISTS public.security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  member_idle_minutes integer NOT NULL DEFAULT 10,
  console_idle_minutes integer NOT NULL DEFAULT 10,
  countdown_seconds integer NOT NULL DEFAULT 10,
  beep_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_settings TO authenticated;
GRANT INSERT, UPDATE ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_settings_read" ON public.security_settings;
CREATE POLICY "security_settings_read" ON public.security_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "security_settings_write" ON public.security_settings;
CREATE POLICY "security_settings_write" ON public.security_settings
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  );

CREATE TRIGGER security_settings_touch
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.security_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

-- 3. Editable per-role help text
CREATE TABLE IF NOT EXISTS public.role_help (
  role app_role PRIMARY KEY,
  summary text NOT NULL DEFAULT '',
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_help TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.role_help TO authenticated;
GRANT ALL ON public.role_help TO service_role;

ALTER TABLE public.role_help ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_help_read" ON public.role_help;
CREATE POLICY "role_help_read" ON public.role_help
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_help_write" ON public.role_help;
CREATE POLICY "role_help_write" ON public.role_help
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
  );

CREATE TRIGGER role_help_touch
  BEFORE UPDATE ON public.role_help
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.role_help (role, summary) VALUES
  ('admin', 'Full access to every part of the admin console, including user management, finance and backups.'),
  ('superadmin', 'Same complete access as Admin. Reserved for the organisation''s most senior system owner.'),
  ('developer', 'Full super-admin access for technical maintenance: configuration, integrations, backups and data tools.'),
  ('staff', 'Day-to-day secretariat work: member applications, directory entries, support tickets and website content.'),
  ('finance', 'Payments, subscription confirmations and financial reports.'),
  ('ceo', 'Read-heavy oversight of payments, membership growth and reports.'),
  ('coordinator', 'Member readiness, certificates and trade opportunities coordination.'),
  ('moderator', 'Limited content moderation duties as granted by an administrator.'),
  ('user', 'Standard member access to the member dashboard, directory, resources and support.')
ON CONFLICT (role) DO NOTHING;