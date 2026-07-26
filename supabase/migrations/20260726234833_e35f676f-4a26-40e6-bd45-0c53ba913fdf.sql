
CREATE OR REPLACE FUNCTION public.admin_list_public_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
    OR public.has_role(auth.uid(), 'developer'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(name ORDER BY name), '[]'::jsonb)
    FROM (
      SELECT c.relname AS name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    ) t
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_public_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_public_tables() TO service_role;
