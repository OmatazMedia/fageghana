CREATE TABLE public.backup_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('google_drive','aws_s3','dropbox','sftp','webhook')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_destinations TO authenticated;
GRANT ALL ON public.backup_destinations TO service_role;
ALTER TABLE public.backup_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_dest admins manage" ON public.backup_destinations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'superadmin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_role(auth.uid(),'superadmin'::public.app_role));
CREATE TRIGGER backup_destinations_touch_updated_at
  BEFORE UPDATE ON public.backup_destinations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();