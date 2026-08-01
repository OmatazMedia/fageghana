CREATE OR REPLACE FUNCTION public.console_account_for_email(_email text)
RETURNS TABLE(user_id uuid, exists_console boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = u.id
             AND ur.role IN ('admin','superadmin','developer','staff','finance','ceo','coordinator')
         )
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(_email))
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.console_account_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.console_account_for_email(text) TO service_role;
