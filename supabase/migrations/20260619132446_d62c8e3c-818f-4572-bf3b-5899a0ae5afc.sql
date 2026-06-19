
-- Backup schedules (singleton-ish; we keep a single active row)
CREATE TABLE IF NOT EXISTS public.backup_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily',
  cron_expression text,
  hour_of_day int NOT NULL DEFAULT 2,
  minute_of_hour int NOT NULL DEFAULT 0,
  day_of_week int NOT NULL DEFAULT 1,
  day_of_month int NOT NULL DEFAULT 1,
  retention_days int NOT NULL DEFAULT 30,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  next_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_schedules TO authenticated;
GRANT ALL ON public.backup_schedules TO service_role;
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage backup schedules"
  ON public.backup_schedules FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_backup_schedules_updated
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backup runs (history)
CREATE TABLE IF NOT EXISTS public.backup_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  size_bytes bigint,
  path text,
  tables_count int,
  error_message text,
  trigger text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;
ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view backup runs"
  ON public.backup_runs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage backup runs"
  ON public.backup_runs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_backup_runs_started ON public.backup_runs (started_at DESC);

-- Seed a single schedule row if none exists
INSERT INTO public.backup_schedules (enabled, frequency, hour_of_day, minute_of_hour, retention_days)
SELECT false, 'daily', 2, 0, 30
WHERE NOT EXISTS (SELECT 1 FROM public.backup_schedules);

-- Per-plan certificate template
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS certificate_template_id uuid REFERENCES public.certificate_templates(id) ON DELETE SET NULL;

-- Admin helper to reset member_id sequence starting point
CREATE OR REPLACE FUNCTION public.admin_set_member_id_start(_n bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF _n < 1 THEN
    RAISE EXCEPTION 'Starting number must be >= 1';
  END IF;
  PERFORM setval('public.member_id_seq', _n, false);
  RETURN _n;
END;
$$;

-- Admin helper to read current next value (without consuming)
CREATE OR REPLACE FUNCTION public.admin_get_member_id_next()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END
    INTO v FROM public.member_id_seq;
  RETURN v;
END;
$$;
