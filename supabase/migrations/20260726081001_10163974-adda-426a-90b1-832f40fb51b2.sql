
CREATE OR REPLACE FUNCTION public.generate_structured_member_id(_abbrev text, _year integer DEFAULT NULL::integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  yyyy int := COALESCE(_year, extract(year from now())::int);
  key text := yyyy::text || '-' || upper(_abbrev);
  seq int;
BEGIN
  INSERT INTO public.member_id_counters(year_abbrev, next_seq)
  VALUES (key, 2)
  ON CONFLICT (year_abbrev) DO UPDATE
    SET next_seq = public.member_id_counters.next_seq + 1,
        updated_at = now()
  RETURNING (next_seq - 1) INTO seq;

  RETURN 'FAGE/' || upper(_abbrev) || '/' || lpad(yyyy::text, 4, '0') || '/' || lpad(seq::text, 5, '0');
END;
$function$;
