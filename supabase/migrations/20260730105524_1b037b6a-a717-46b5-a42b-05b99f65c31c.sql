CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_fingerprint text NOT NULL,
  device_label text,
  browser text,
  os text,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  revoked_reason text,
  suspicious boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions"
ON public.user_sessions FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
  OR public.has_role(auth.uid(), 'developer'::app_role)
);

CREATE POLICY "Users insert own sessions"
ON public.user_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own sessions"
ON public.user_sessions FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
  OR public.has_role(auth.uid(), 'developer'::app_role)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
  OR public.has_role(auth.uid(), 'developer'::app_role)
);

CREATE INDEX user_sessions_user_last_seen_idx
  ON public.user_sessions (user_id, last_seen_at DESC);
CREATE INDEX user_sessions_fingerprint_idx
  ON public.user_sessions (user_id, session_fingerprint);

CREATE TRIGGER user_sessions_touch
BEFORE UPDATE ON public.user_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.revoke_user_session(_id uuid, _reason text DEFAULT 'manual')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  owner uuid;
BEGIN
  SELECT user_id INTO owner FROM public.user_sessions WHERE id = _id;
  IF owner IS NULL THEN RETURN; END IF;
  IF owner <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::app_role)
     AND NOT public.has_role(auth.uid(), 'superadmin'::app_role)
     AND NOT public.has_role(auth.uid(), 'developer'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.user_sessions
    SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = _reason
    WHERE id = _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_my_other_sessions(_keep_fingerprint text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.user_sessions
    SET revoked_at = now(), revoked_reason = 'revoked_other_devices'
    WHERE user_id = auth.uid()
      AND revoked_at IS NULL
      AND session_fingerprint IS DISTINCT FROM _keep_fingerprint;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_my_other_sessions(text) TO authenticated;