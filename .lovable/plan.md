## 1. Certificate designer — render matches preview

**Problem:** the issued/downloaded certificate doesn't match the live designer preview (positions, font sizing, signature/QR scale all drift, especially when the background image's natural size differs from `layout.canvas.w/h`).

**Fix in `src/lib/certificate-render.ts`:**
- Always render at `layout.canvas.w × layout.canvas.h` (never fall back to `bg.naturalWidth`), so positions stored in designer-space map 1:1 to output pixels.
- Match the preview's text anchor: designer uses CSS `top: y` + `translate(0,-100%)` (bottom-of-text at y). Switch canvas rendering to `ctx.textBaseline = "bottom"` so the issued PNG/PDF lines up exactly with what was dragged in the designer.
- Load Google Fonts (`Playfair Display`, `Inter`, plus any font used in `field.font`) via `document.fonts.load()` before drawing, so the issued cert uses the same typefaces shown in the preview instead of a system fallback.
- For the signature image: respect the stored `w/h` box and draw with `object-fit: contain` math (same as the preview's `object-contain`) instead of stretching.
- For the QR: use `layout.qr.size` directly, but compute border the same way the preview does (border padded outside the QR, not stretching it).

**Fix in `src/routes/admin.certificates.tsx` preview pane:**
- Make the preview text anchor explicit and identical to the renderer (single shared helper for `transform`/baseline) so the two stay in sync.

## 2. Multiple authorized signers per template

Today a template stores a single `authorized_name` + `signature_url`. Replace with a list, each item: `{ id, label, name, signature_url, x, y, w, h, visible }`. `label` is admin-only ("CEO", "President", etc.) so admins know whose file is attached; the cert shows `name` next to its signature.

**Database (migration):**
- Add `signers jsonb not null default '[]'` to `certificate_templates`.
- One-time backfill: build `[{id, label:'Primary', name: authorized_name, signature_url, x,y,w,h, visible:true}]` from existing columns for every row. Keep the old columns for now (read fallback) so nothing breaks; we can drop them later.

**Admin UI (`src/routes/admin.certificates.tsx`):**
- Replace the single signer block with a "Signers" list: add/remove/reorder rows, each row has Label input, Name input, file upload (uses existing `certificate-assets` bucket), and a draggable box in the preview.
- Each signer renders in the designer preview at its own `x/y/w/h` and is independently draggable.

**Renderer (`src/lib/certificate-render.ts` + `verify_certificate` display):**
- Iterate `template.signers`; for each visible signer, draw the signature image at its box and the `name` text under it (using a shared field-style block).
- Verification page lists each signer's `name + label`.

## 3. Admin sidebar label: "News" → "News & Blog"

In `src/routes/admin.tsx`:
- Line 75: change `label: "News"` to `label: "News & Blog"`.
- Line 420: change quick-action `label: "Add news article"` to `label: "Add news / blog post"`.

Front-end nav already reads "News & Blog" (`SiteHeader.tsx`). Also update `SiteFooter.tsx` link text (line 82) for consistency.

## 4. Blog post not displaying when slug link is clicked

**Diagnosis steps (build mode):**
1. Open one of the live slugs (e.g. `/news/ghana-horticulture-expo-2024`) in the preview and read console + network. The query in `news.$slug.tsx` is `from('news').select('*').eq('slug', slug).eq('published', true).maybeSingle()` and the DB shows all rows have `published = true`, so the most likely causes are:
   - **RLS** blocking anon `SELECT` on `news` (no auth session on the public page) → fix by adding/verifying a policy `news_public_read` allowing `SELECT` where `published = true` to role `anon, authenticated`.
   - **Empty `body`** on the row (designer never saved it) → fall back to rendering `excerpt` and log a warning.
   - **TipTap HTML body** that begins with whitespace/comment so `isHtml` check (`startsWith('<')`) fails and it's split into `<p>` containing raw HTML → make the detector more robust (`/^\s*</.test(body)` or store a `body_format` column).
2. Apply whichever of the above the diagnosis points to. Most likely fix: RLS policy + tightening the HTML detector.

**Layout polish on `news.$slug.tsx` (user request):**
- Convert the current single-column flow into the requested layout: article on the left, **sticky right sidebar** (recent posts, categories, newsletter) — sidebar element gets `lg:sticky lg:top-24 self-start`.
- Below the body keep the existing Share + Reactions and Prev/Next + Related blocks (already present).
- Add a "← Back to News & Blog" button at the top of the article (links to `/news`).

## Technical notes

- No new packages required.
- Migration is additive (`signers jsonb`), with a fallback read so old templates keep working until the UI saves them in the new shape.
- All work stays in: `src/lib/certificate-render.ts`, `src/routes/admin.certificates.tsx`, `src/routes/admin.tsx`, `src/routes/news.$slug.tsx`, `src/components/site/SiteFooter.tsx`, plus one Supabase migration and (likely) one RLS policy migration for `public.news`.
