CREATE TABLE public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  subnet text NOT NULL,
  email_tried text,
  outcome text NOT NULL,
  portal text NOT NULL DEFAULT 'admin',
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX login_attempts_ip_created_idx ON public.login_attempts (ip, created_at DESC);
CREATE INDEX login_attempts_subnet_created_idx ON public.login_attempts (subnet, created_at DESC);
CREATE INDEX login_attempts_created_idx ON public.login_attempts (created_at DESC);

CREATE TABLE public.ip_bans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip text NOT NULL,
  subnet text NOT NULL,
  reason text,
  warning_count integer NOT NULL DEFAULT 0,
  strikes integer NOT NULL DEFAULT 0,
  last_email_tried text,
  banned_at timestamp with time zone,
  expires_at timestamp with time zone,
  unbanned_at timestamp with time zone,
  unbanned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ip_bans TO service_role;
ALTER TABLE public.ip_bans ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX ip_bans_ip_key ON public.ip_bans (ip);
CREATE INDEX ip_bans_subnet_idx ON public.ip_bans (subnet);
CREATE INDEX ip_bans_active_idx ON public.ip_bans (expires_at) WHERE unbanned_at IS NULL;

CREATE TRIGGER ip_bans_touch_updated_at
  BEFORE UPDATE ON public.ip_bans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.purge_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '90 days';
$$;
