
-- 1) Fix directory enum mismatch in submit_my_directory_entry
CREATE OR REPLACE FUNCTION public.submit_my_directory_entry(_payload jsonb, _submit boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  active boolean;
  existing_id uuid;
  new_status text;
  base_slug text;
  final_slug text;
  i int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT (subscription_expiry IS NOT NULL AND subscription_expiry > now())
    INTO active FROM public.member_profiles WHERE user_id = uid;
  IF NOT COALESCE(active, false) THEN
    RAISE EXCEPTION 'Active subscription required to publish a directory listing';
  END IF;

  new_status := CASE WHEN _submit THEN 'pending' ELSE 'draft' END;

  SELECT id INTO existing_id FROM public.directory_entries WHERE user_id = uid;

  base_slug := COALESCE(NULLIF(_payload->>'slug',''),
                        lower(regexp_replace(COALESCE(_payload->>'company_name',''), '[^a-zA-Z0-9]+', '-', 'g')));
  base_slug := trim(both '-' from base_slug);
  IF base_slug = '' THEN base_slug := 'member-' || substr(uid::text,1,8); END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.directory_entries WHERE slug = final_slug AND (existing_id IS NULL OR id <> existing_id)) LOOP
    i := i + 1;
    final_slug := base_slug || '-' || i;
  END LOOP;

  IF existing_id IS NULL THEN
    INSERT INTO public.directory_entries (
      user_id, entry_type, slug, company_name, short_description, long_description,
      mission, vision, services, products, executives, director_name,
      contact_name, phone, email, website, physical_address, postal_address,
      country, region, logo_url, cover_image_url, category, custom_fields,
      status, submitted_at, published
    ) VALUES (
      uid,
      COALESCE(NULLIF(_payload->>'entry_type','')::directory_entry_type, 'corporate'::directory_entry_type),
      final_slug,
      COALESCE(_payload->>'company_name',''),
      _payload->>'short_description',
      _payload->>'long_description',
      _payload->>'mission',
      _payload->>'vision',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'services')), '{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'products')), '{}'),
      COALESCE(_payload->'executives','[]'::jsonb),
      _payload->>'director_name',
      _payload->>'contact_name',
      _payload->>'phone',
      _payload->>'email',
      _payload->>'website',
      _payload->>'physical_address',
      _payload->>'postal_address',
      COALESCE(_payload->>'country','Ghana'),
      _payload->>'region',
      _payload->>'logo_url',
      _payload->>'cover_image_url',
      _payload->>'category',
      COALESCE(_payload->'custom_fields','{}'::jsonb),
      new_status,
      CASE WHEN _submit THEN now() ELSE NULL END,
      true
    ) RETURNING id INTO existing_id;
  ELSE
    UPDATE public.directory_entries SET
      entry_type        = COALESCE(NULLIF(_payload->>'entry_type','')::directory_entry_type, entry_type),
      slug              = final_slug,
      company_name      = COALESCE(_payload->>'company_name', company_name),
      short_description = _payload->>'short_description',
      long_description  = _payload->>'long_description',
      mission           = _payload->>'mission',
      vision            = _payload->>'vision',
      services          = COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'services')), '{}'),
      products          = COALESCE(ARRAY(SELECT jsonb_array_elements_text(_payload->'products')), '{}'),
      executives        = COALESCE(_payload->'executives','[]'::jsonb),
      director_name     = _payload->>'director_name',
      contact_name      = _payload->>'contact_name',
      phone             = _payload->>'phone',
      email             = _payload->>'email',
      website           = _payload->>'website',
      physical_address  = _payload->>'physical_address',
      postal_address    = _payload->>'postal_address',
      country           = COALESCE(_payload->>'country', country),
      region            = _payload->>'region',
      logo_url          = _payload->>'logo_url',
      cover_image_url   = _payload->>'cover_image_url',
      category          = _payload->>'category',
      custom_fields     = COALESCE(_payload->'custom_fields','{}'::jsonb),
      status            = new_status,
      submitted_at      = CASE WHEN _submit THEN now() ELSE submitted_at END,
      updated_at        = now()
    WHERE id = existing_id;
  END IF;

  RETURN existing_id;
END;
$function$;

-- 2) Contact messages: handled_at column for admin triage
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

-- 3) Admin notification settings (singleton) for chatbot "Leave a message" recipients
CREATE TABLE IF NOT EXISTS public.admin_notification_settings (
  id int PRIMARY KEY DEFAULT 1,
  chat_message_recipients text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_notification_settings_singleton CHECK (id = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notification_settings TO authenticated;
GRANT ALL ON public.admin_notification_settings TO service_role;

ALTER TABLE public.admin_notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage notification settings" ON public.admin_notification_settings;
CREATE POLICY "Admins manage notification settings"
  ON public.admin_notification_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'superadmin'::app_role));

INSERT INTO public.admin_notification_settings (id, chat_message_recipients)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;
