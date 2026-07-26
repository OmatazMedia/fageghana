ALTER TABLE public.activities DROP COLUMN IF EXISTS ip_address;
ALTER TABLE public.activities DROP COLUMN IF EXISTS user_agent;
DROP INDEX IF EXISTS public.activities_event_type_idx;
ALTER TABLE public.activities DROP COLUMN IF EXISTS event_type;