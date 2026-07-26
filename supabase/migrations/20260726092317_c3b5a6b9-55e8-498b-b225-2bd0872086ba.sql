
DROP POLICY IF EXISTS "Members view directory rows" ON public.member_profiles;

DROP POLICY IF EXISTS "read counters" ON public.member_id_counters;
CREATE POLICY "Admins and staff read counters"
  ON public.member_id_counters FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'staff'::app_role)
    OR public.has_role(auth.uid(),'superadmin'::app_role)
  );

DROP POLICY IF EXISTS "role_perms read" ON public.role_permissions;
CREATE POLICY "Users read their own role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'superadmin'::app_role)
    OR public.has_role(auth.uid(), role)
  );
