
ALTER TABLE public.directory_entries
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_admin_owned boolean NOT NULL DEFAULT false;

UPDATE public.directory_entries SET is_admin_owned = true WHERE user_id IS NULL;

-- Replace public SELECT policies to also require is_active
DROP POLICY IF EXISTS "Public can view approved published entries" ON public.directory_entries;
DROP POLICY IF EXISTS "Anon can view approved published entries" ON public.directory_entries;
DROP POLICY IF EXISTS "Authenticated can view approved published entries" ON public.directory_entries;

CREATE POLICY "Anon can view approved published entries"
  ON public.directory_entries FOR SELECT TO anon
  USING (published = true AND status = 'approved' AND is_active = true);

CREATE POLICY "Authenticated can view approved published entries"
  ON public.directory_entries FOR SELECT TO authenticated
  USING (
    (published = true AND status = 'approved' AND is_active = true)
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

-- Extend review RPC with activate/deactivate
CREATE OR REPLACE FUNCTION public.admin_review_directory_entry(_id uuid, _action text, _notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin'::app_role)
     AND NOT public.has_role(auth.uid(),'staff'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _action NOT IN ('approve','reject','withdraw','suspend','activate','deactivate') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  IF _action IN ('activate','deactivate') THEN
    UPDATE public.directory_entries
      SET is_active = (_action = 'activate'),
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          review_notes = COALESCE(_notes, review_notes)
      WHERE id = _id;
  ELSE
    UPDATE public.directory_entries
      SET status = CASE _action
                     WHEN 'approve'  THEN 'approved'
                     WHEN 'reject'   THEN 'rejected'
                     WHEN 'withdraw' THEN 'pending'
                     WHEN 'suspend'  THEN 'suspended'
                   END,
          reviewed_at = now(),
          reviewed_by = auth.uid(),
          review_notes = _notes
      WHERE id = _id;
  END IF;
END;
$function$;
