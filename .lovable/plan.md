# FAGE Exporter Directory

Build a public directory at `/directory` that combines admin-curated entries with approved member profiles, plus an admin manager for the curated entries. Seed it with everything from the uploaded PDF and DOCX.

## What the visitor sees

`/directory` (public, no login required):

- Sticky search bar with **live search** on company name, contact name/director, email, phone, products, country.
- Filters: type (All / Associations / Corporate Members), category/products.
- Result grid of cards: logo, company name, type badge, products, country, "View details" button.
- Detail view (modal or `/directory/$slug`): logo, full description, mission/vision (associations), services, executives (associations), director (corporate), products, full contact block (address, phone, email, website).
- SEO: per-route `head()` with title, meta description, OG image (entry logo).
- Empty state + skeleton loaders.

## Data source

Union of:
1. New `directory_entries` table (admin-managed, seeded from docs).
2. Existing `member_profiles` rows where `status='approved' AND directory_visible=true` (already wired in `admin.directory.tsx`).

A single public server fn `listDirectory()` merges, de-duplicates by email, and returns one normalized shape so the UI doesn't care which source a row came from.

## Database

New table `public.directory_entries`:

- `entry_type` enum: `association` | `corporate`
- `slug` (unique, used in detail URL)
- `company_name`, `short_description`, `long_description`
- `mission`, `vision` (associations)
- `services` (text[]), `products` (text[])
- `executives` jsonb — `[{role, name}]` (associations: President, VP, Secretary, Treasurer)
- `director_name` (corporate)
- `contact_name`, `phone`, `email`, `website`
- `physical_address`, `postal_address`, `country` (default Ghana), `region`
- `logo_url`, `cover_image_url`
- `category` (e.g. Pineapples, Vegetables, Mangoes, Coconut, Roots & Tubers, Consultancy)
- `featured` boolean, `display_order` int, `published` boolean

RLS:
- Public `SELECT` where `published = true`.
- Admin manages all (insert/update/delete) via `has_role(auth.uid(),'admin')`.
- Explicit `GRANT SELECT TO anon, authenticated`; full grants to `authenticated` gated by admin policy; `service_role` ALL.

Storage: reuse existing public `content` bucket for logos under `directory/logos/`.

## Admin manager

New route `/admin/directory-entries` (linked from admin sidebar; rename existing `/admin/directory` link to "Member visibility" to avoid confusion, or fold it into a tabbed page — see Open Question 1):

- List with live search, type filter, published toggle, drag-style display order, "Featured" toggle.
- Create / Edit modal with all fields above; logo upload via existing `uploadImage` helper.
- Dynamic executives editor (add/remove rows).
- Products / services as tag inputs.
- Delete with confirmation.

Server fns in `src/lib/directory.functions.ts`:
- `listDirectory()` — public, merges curated + approved members.
- `getDirectoryEntry(slug)` — public.
- `upsertDirectoryEntry(...)` — admin only (`requireSupabaseAuth` + role check).
- `deleteDirectoryEntry(id)` — admin only.

## Seed data

Insert migration that loads all entries from the uploaded files:

- **6 Associations**: SPEG, GROCTEU, GAVEX, VEPEAG, Yilo Krobo Mango Farmers Association, Coconut Federation Ghana — with mission, vision, services, executives, full contacts.
- **~25 Corporate Members**: Mount Sunset Farms, Farm 360, Iribov West Africa, Kaleawo, Touch Skies, Green Earth, Panaasa, Rosswood, Yeboah Kwesi Farms, S.K. Essel Farms, De-Vault Farms, Conyx Merchantile, Vivifos, Martinkings, Shrigan Farms, RBD Organic Agro, Yea Ecstasy, HJA Africa, Adinkrah-Heritage, Shapes PRO, Vedent, Veroni Ventures, Gyarko Farms, Mitish Farms, Eco Supreme, Tiwaa Farms, Plantation Hub Africa, GAPS Consults, Aseda Foods.

Logos left null — admin uploads them later (the parsed images are low-res page extracts, not clean logos).

## Files

Created:
- `supabase/migrations/<ts>_directory_entries.sql` — table, enum, RLS, grants, seed inserts.
- `src/lib/directory.functions.ts` — server fns.
- `src/routes/directory.tsx` — public list + live search.
- `src/routes/directory.$slug.tsx` — public detail page (SEO-friendly).
- `src/routes/admin.directory-entries.tsx` — admin manager.
- `src/components/directory/DirectoryCard.tsx`, `DirectoryFilters.tsx`, `ExecutivesEditor.tsx`.

Edited:
- `src/routes/admin.tsx` — add sidebar link "Directory Entries".
- `src/components/site/SiteHeader.tsx` — add "Directory" nav link.
- `src/integrations/supabase/types.ts` — auto-regenerated after migration.

No edits to `client.ts`, `client.server.ts`, `auth-middleware.ts`, `.env`, or `config.toml`.

## Open questions

1. The existing `/admin/directory` page toggles visibility of member_profiles in the directory. Keep it as-is and add `/admin/directory-entries` separately, or merge both into one tabbed page (`Curated entries` | `Member visibility`)? **Default: merge into one tabbed page** unless you say otherwise.
2. Detail view: full page at `/directory/$slug` (better SEO, shareable) vs modal-only (faster, no extra route). **Default: full page** for SEO.
