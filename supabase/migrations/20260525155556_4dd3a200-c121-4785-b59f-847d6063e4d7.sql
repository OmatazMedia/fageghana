ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS signers jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing single-signer rows into the new signers array
UPDATE public.certificate_templates
SET signers = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'label', 'Primary',
    'name', COALESCE(authorized_name, 'FAGE President'),
    'signature_url', signature_url,
    'x', COALESCE((field_positions->'signature'->>'x')::numeric, 600),
    'y', COALESCE((field_positions->'signature'->>'y')::numeric, 760),
    'w', COALESCE((field_positions->'signature'->>'w')::numeric, 220),
    'h', COALESCE((field_positions->'signature'->>'h')::numeric, 80),
    'nameOffsetY', 96,
    'nameFontSize', 20,
    'nameFontFamily', '''Inter'', sans-serif',
    'nameFontWeight', '600',
    'nameColor', '#1a1a1a',
    'visible', true
  )
)
WHERE jsonb_array_length(signers) = 0;