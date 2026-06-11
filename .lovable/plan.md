## Goal

1. Give admins a rich, **dynamic form** to create/edit a directory entry — including logo, mission, executives, products, etc. — plus the ability to **define extra custom fields** (text, textarea, number, email, URL, phone, dropdown, radio, checkboxes, image upload, file upload) without touching code or schema.
2. Make the **backup system auto-discover every public table** so newly-created tables and columns are included automatically.

## Approach

### Part A — Directory form

- Keep the existing `directory_entries` columns as the "core" structured form (logo, cover, company_name, slug, mission, vision, services, products, executives, contact, address, etc.).
- Add one new JSONB column `custom_fields` on `directory_entries` to store admin-defined extras. **No ALTER TABLE per field** = safe + auto-backed-up.
- New table `directory_custom_field_defs` storing the schema of admin-defined fields:
  - `key` (slug), `label`, `type` (text | textarea | number | email | url | phone | dropdown | radio | checkboxes | image | file), `options` (jsonb for choice fields), `required`, `display_order`, `active`.
  - RLS: admins manage; public read (so the public directory detail page can render them).

### Part B — Admin UI (`/admin/directory-entries`)

- Replace the current modal with a tabbed editor:
  - **Tab 1 – Core details**: logo + cover upload, entry_type, company_name, slug, category, mission, vision, short/long description, website, email, phone, contact name, region/country, addresses, services (tag input), products (tag input), executives (existing editor), featured/published toggles, display_order.
  - **Tab 2 – Custom fields**: renders every active field from `directory_custom_field_defs`, writes values into `custom_fields` JSONB. Image/file inputs upload to the `content` bucket and store the public URL.
- New admin page **`/admin/directory-fields`** — a field-builder:
  - List, reorder (display_order), add, edit, delete custom field definitions.
  - When type is dropdown/radio/checkboxes, edit the options list.
  - Toggle active.

### Part C — Public directory detail page

- Extend `/directory/$slug` to render any active custom fields below the core profile (image fields show as images, file fields as download links, choice fields as text/badges).

### Part D — Auto-discovering backup

- Replace the current backup function logic so it queries `information_schema.tables` for every table in `public` (excluding `*_migrations` style internals) and dumps each to JSON in the `backups` bucket under a single timestamped folder, with a `manifest.json` listing tables + row counts + column lists.
- Implemented via a new `SECURITY DEFINER` RPC `admin_dump_table(table_name text)` that returns `jsonb_agg(t)` for any public table (admin-only), called from the existing backup server function which now iterates discovered tables.
- Existing scheduled / on-demand backup trigger keeps working — only the table list is now dynamic.

## Technical Details

**Migrations**
- `ALTER TABLE directory_entries ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;`
- `CREATE TABLE directory_custom_field_defs(...)` + GRANTs + RLS (admin ALL, anon+authenticated SELECT where active).
- `CREATE FUNCTION admin_list_public_tables()` and `admin_dump_table(_name text)` — both `SECURITY DEFINER`, admin-gated via `has_role(auth.uid(), 'admin')`.

**Files**
- New: `src/routes/admin.directory-fields.tsx`, `src/components/admin/DynamicFieldRenderer.tsx`.
- Edited: `src/routes/admin.directory-entries.tsx` (tabbed editor + custom fields tab), `src/routes/directory.$slug.tsx` (render custom fields), `src/routes/admin.tsx` (sidebar link), `src/lib/backup.functions.ts` (auto-discover tables).

**Storage**
- Reuse the existing public `content` bucket for custom image/file uploads under `directory/custom/<entryId>/...`.

## Out of scope

- True per-field SQL columns (rejected — chose JSON approach).
- Reordering custom fields via drag-and-drop (will use a numeric order input; drag can come later).
