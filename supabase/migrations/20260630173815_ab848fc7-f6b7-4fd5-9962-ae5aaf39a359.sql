
CREATE TABLE IF NOT EXISTS public.site_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  eyebrow text,
  title text,
  subtitle text,
  cta_label text,
  cta_href text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_hero_slides TO anon, authenticated;
GRANT ALL ON public.site_hero_slides TO service_role;
ALTER TABLE public.site_hero_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active hero slides" ON public.site_hero_slides
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage hero slides" ON public.site_hero_slides
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.site_partner_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text NOT NULL,
  link_url text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_partner_logos TO anon, authenticated;
GRANT ALL ON public.site_partner_logos TO service_role;
ALTER TABLE public.site_partner_logos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active partner logos" ON public.site_partner_logos
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage partner logos" ON public.site_partner_logos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_site_hero_slides_updated ON public.site_hero_slides;
CREATE TRIGGER trg_site_hero_slides_updated BEFORE UPDATE ON public.site_hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_site_partner_logos_updated ON public.site_partner_logos;
CREATE TRIGGER trg_site_partner_logos_updated BEFORE UPDATE ON public.site_partner_logos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.site_hero_slides (image_url, eyebrow, title, display_order)
SELECT * FROM (VALUES
  ('https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/5-12.png','Promoting non traditional exporters','Federation of Associations of Ghanaian Exporters',1),
  ('https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/10-13.png','Promoting non traditional exporters','Federation of Associations of Ghanaian Exporters',2)
) AS v(image_url,eyebrow,title,display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.site_hero_slides);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_submissions' AND policyname='Members update own pending submissions'
  ) THEN
    CREATE POLICY "Members update own pending submissions" ON public.payment_submissions
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid() AND status = 'pending')
      WITH CHECK (user_id = auth.uid() AND status = 'pending');
  END IF;
END $$;
