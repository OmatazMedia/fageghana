
-- 1) custom_fields JSON column on directory_entries
ALTER TABLE public.directory_entries
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) directory_custom_field_defs
CREATE TABLE IF NOT EXISTS public.directory_custom_field_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN (
    'text','textarea','number','email','url','phone',
    'dropdown','radio','checkboxes','image','file'
  )),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  help_text text,
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('both','association','corporate')),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.directory_custom_field_defs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_custom_field_defs TO authenticated;
GRANT ALL ON public.directory_custom_field_defs TO service_role;

ALTER TABLE public.directory_custom_field_defs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view active custom field defs" ON public.directory_custom_field_defs;
CREATE POLICY "Anyone view active custom field defs"
  ON public.directory_custom_field_defs FOR SELECT
  TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Admins view all custom field defs" ON public.directory_custom_field_defs;
CREATE POLICY "Admins view all custom field defs"
  ON public.directory_custom_field_defs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage custom field defs" ON public.directory_custom_field_defs;
CREATE POLICY "Admins manage custom field defs"
  ON public.directory_custom_field_defs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_directory_custom_field_defs_updated ON public.directory_custom_field_defs;
CREATE TRIGGER trg_directory_custom_field_defs_updated
  BEFORE UPDATE ON public.directory_custom_field_defs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) auto-discovery helpers for backups
CREATE OR REPLACE FUNCTION public.admin_list_public_tables()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb) FROM (
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ) t;
$$;

CREATE OR REPLACE FUNCTION public.admin_dump_table(_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = _name
  ) THEN
    RAISE EXCEPTION 'Table public.% does not exist or is not a base table', _name;
  END IF;
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) FROM public.%I t', _name)
    INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_public_tables() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_dump_table(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_dump_table(text) TO service_role;
