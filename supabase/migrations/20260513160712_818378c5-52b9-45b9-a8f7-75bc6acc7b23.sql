
-- Private backups bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: only admins
CREATE POLICY "Admins read backups"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins write backups"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update backups"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete backups"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only SQL exec (callable only via service role since we never grant to authenticated)
CREATE OR REPLACE FUNCTION public.admin_exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_exec_sql(text) FROM PUBLIC, anon, authenticated;

-- Schema introspection: list public tables with columns + PK
CREATE OR REPLACE FUNCTION public.admin_list_tables()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
    SELECT
      c.relname AS name,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'notnull', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid)
        ) ORDER BY a.attnum)
        FROM pg_attribute a
        LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      ) AS columns,
      (
        SELECT jsonb_agg(att.attname ORDER BY att.attnum)
        FROM pg_index i
        JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = ANY(i.indkey)
        WHERE i.indrelid = c.oid AND i.indisprimary
      ) AS pk
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  ) t;
$$;

REVOKE ALL ON FUNCTION public.admin_list_tables() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_enums()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (
    SELECT t.typname AS name,
      (SELECT jsonb_agg(enumlabel ORDER BY enumsortorder)
       FROM pg_enum WHERE enumtypid = t.oid) AS values
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e'
    ORDER BY t.typname
  ) e;
$$;

REVOKE ALL ON FUNCTION public.admin_list_enums() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_functions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM (
    SELECT p.proname AS name,
           pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname NOT IN ('admin_exec_sql','admin_list_tables','admin_list_enums','admin_list_functions','admin_list_policies','admin_list_sequences')
    ORDER BY p.proname
  ) f;
$$;

REVOKE ALL ON FUNCTION public.admin_list_functions() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_policies()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM (
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  ) p;
$$;

REVOKE ALL ON FUNCTION public.admin_list_policies() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_sequences()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(s), '[]'::jsonb) FROM (
    SELECT c.relname AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
    ORDER BY c.relname
  ) s;
$$;

REVOKE ALL ON FUNCTION public.admin_list_sequences() FROM PUBLIC, anon, authenticated;
