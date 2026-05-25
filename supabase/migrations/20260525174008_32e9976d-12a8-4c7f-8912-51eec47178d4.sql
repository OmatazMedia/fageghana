
-- Staff: read + update member_profiles (no delete, no insert)
CREATE POLICY "Staff view all profiles"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff update profiles"
  ON public.member_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

-- Staff: view applications + payments (read-only support)
CREATE POLICY "Staff view applications"
  ON public.membership_applications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Staff view payments"
  ON public.payment_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'::app_role));

-- Moderator: manage News
CREATE POLICY "Moderators manage news"
  ON public.news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

-- Moderator: manage Media
CREATE POLICY "Moderators manage media"
  ON public.media FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));

-- Moderator: manage Activities/Events
CREATE POLICY "Moderators manage activities"
  ON public.activities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'moderator'::app_role));
