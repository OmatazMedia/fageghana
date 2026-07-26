
-- Update the structured ID generator to output FAGE/{ABBR}/{YYYY-padded-from-YY}/{SEQ}
CREATE OR REPLACE FUNCTION public.generate_structured_member_id(_abbrev text, _year integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  yy   text := lpad((COALESCE(_year, extract(year from now())::int) % 100)::text, 2, '0');
  year_code text := lpad(yy, 4, '0'); -- e.g. 26 -> 0026
  key text := year_code || '-' || upper(_abbrev);
  seq int;
BEGIN
  INSERT INTO public.member_id_counters(year_abbrev, next_seq)
  VALUES (key, 2)
  ON CONFLICT (year_abbrev) DO UPDATE
    SET next_seq = public.member_id_counters.next_seq + 1,
        updated_at = now()
  RETURNING (next_seq - 1) INTO seq;

  RETURN 'FAGE/' || upper(_abbrev) || '/' || year_code || '/' || lpad(seq::text, 5, '0');
END;
$function$;

-- Regularize the existing legacy member ID (FAGE-STD-26000004) to the new format.
-- Standard/Startup Business → SB, enrolled 2026 → 0026, first in list → 00001.
DELETE FROM public.member_id_counters WHERE year_abbrev = '0026-SB';
INSERT INTO public.member_id_counters(year_abbrev, next_seq) VALUES ('0026-SB', 2);

UPDATE public.member_profiles
SET member_id = 'FAGE/SB/0026/00001'
WHERE member_id = 'FAGE-STD-26000004';
