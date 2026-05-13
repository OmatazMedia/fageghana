# Backup & Restore System

A new admin-only page (`/admin/backup`) that produces a single downloadable `.zip` snapshot of the entire backend, and accepts that same zip back via drag-and-drop to restore into this project or any other Lovable Cloud project.

## What gets backed up

1. **Database data** — every row of every table in the `public` schema (all 18 tables: `member_profiles`, `subscription_plans`, `payment_submissions`, `application_forms`, `application_submissions`, `certificates`, `certificate_templates`, `news`, `activities`, `media`, `products`, `notifications`, `support_tickets`, `ticket_messages`, `payment_gateways`, `membership_applications`, `user_roles`, plus any future tables discovered via `information_schema`).
2. **Database schema** — `CREATE TABLE`, enums (`app_role`, `membership_tier`, `application_status`, `payment_status`, `media_type`, `ticket_status`), sequences (`member_id_seq`), functions (`has_role`, `set_updated_at`, `generate_member_id`, `handle_new_user_super_admin`), and all RLS policies — reconstructed from `pg_catalog` / `information_schema` so a fresh project can be rebuilt.
3. **Storage buckets** — every file in `content`, `payment-proofs`, `certificate-assets` (downloaded via service-role) plus bucket metadata (public flag, policies).
4. **Auth users** — full list from `auth.admin.listUsers()` with `id`, `email`, `phone`, `email_confirmed_at`, `user_metadata`, `app_metadata`, `created_at`. Roles come from the `user_roles` table.
5. **Manifest** — `manifest.json` with project ref, schema version, table row counts, file counts, timestamp, and a checksum.

## Zip layout

```text
fage-backup-2026-05-13T14-22.zip
├── manifest.json
├── schema/
│   ├── enums.sql
│   ├── functions.sql
│   ├── sequences.sql
│   ├── tables.sql        # CREATE TABLE for every public table
│   └── policies.sql      # RLS enable + policies
├── data/
│   ├── member_profiles.jsonl
│   ├── subscription_plans.jsonl
│   └── … one .jsonl per table
├── auth/
│   └── users.json
└── storage/
    ├── _buckets.json
    ├── content/<original-paths…>
    ├── payment-proofs/<…>
    └── certificate-assets/<…>
```

JSON Lines (one row per line) keeps memory bounded and makes diffs/merges streamable.

## Restore flow

The same page has a drop-zone. Once a zip is dropped:

1. Parse `manifest.json`, show a confirmation modal: source project ref, snapshot date, row counts, file counts.
2. User picks a **mode**:
  - **Merge** — `upsert` rows by primary key, skip storage objects that already exist, create only missing auth users.
  - **Overwrite** — `TRUNCATE … RESTART IDENTITY CASCADE` per table, empty buckets, delete & recreate auth users (except the currently-signed-in admin to avoid lockout).
3. Pre-flight check: for each table in the backup, if the table is missing in the target DB, auto-run the corresponding `CREATE TABLE` / enum / function / policy from `schema/*.sql`. Same for missing buckets.
4. Restore order respects dependencies: enums → sequences → functions → tables → policies → auth users → `user_roles` → other data → storage files.
5. Stream progress back to the UI (per-table row count, per-bucket file count, errors).

## UI

- `/admin/backup` route, gated behind `isAdmin`.
- Two cards side-by-side:
  - **Create backup** — button "Generate backup"; shows a progress log; ends with a download button (the zip is built server-side and returned as a signed URL or streamed response).
  - **Restore backup** — drag-and-drop `.zip` (also a "Choose file" fallback). After parsing manifest, a destructive-action dialog forces the admin to type **RESTORE** to confirm, with mode toggle (Merge / Overwrite) and an explicit warning list:
    - "Overwrite will delete every row in every table currently in this project."
    - "Auth user passwords cannot be restored — affected users will need to reset their password after restore."
    - "Storage objects with the same path will be replaced in Overwrite mode."
    - "Restore runs with service-role privileges and bypasses RLS — only admins can use this."
- Live progress bar + scrolling log; final summary (rows imported, files imported, users imported, errors).

## Server functions

All server-side, all behind `requireSupabaseAuth` + admin role check, all using `supabaseAdmin`:

- `createBackup` — introspects schema, dumps rows, downloads bucket files, builds zip in-memory using `jszip`, returns it as a base64 blob (or, for larger projects, uploads it to a private `backups` bucket and returns a signed URL).
- `parseBackupManifest` — accepts the uploaded zip (base64), returns manifest + counts for the confirmation step (no writes).
- `restoreBackup` — accepts the zip + `{ mode: "merge" | "overwrite" }`, runs the restore plan, returns a summary log.

These live in `src/lib/backup.functions.ts`. A new `backups` storage bucket (private, admin-only RLS) holds generated backup zips so the user can re-download recent ones.

## Known limitations (called out in the UI before backup/restore runs)

- **Auth passwords are not restorable.** Supabase does not expose password hashes via the admin API. Restored users keep their email/metadata/roles, but must reset their password on first login. The restore step will optionally trigger a password-reset email per imported user.
- **Cross-project restore requires the target project's service-role key to be the one signed into Lovable Cloud** — i.e. you run the restore from inside the destination project's `/admin/backup` page.
- **Worker memory ceiling.** Projects with > ~200 MB of storage will be split into multiple zip parts (`part-1.zip`, `part-2.zip`) and the manifest lists them; the restore UI accepts multiple files in one drop.
- **Schema drift.** Custom Supabase-managed schemas (`auth`, `storage`, `realtime`, `vault`) are NEVER recreated — only `public`. Tables added by future migrations are picked up automatically because schema is read from `information_schema` at backup time.
- **Edge functions / secrets are not included.** Secrets (`PAYSTACK_SECRET_KEY`, etc.) must be re-added manually in the destination project — the restore log lists which secret names were referenced so the admin knows what to paste in.

## Files to add / change

- `src/routes/admin.backup.tsx` *(new)* — UI with backup card + drag-and-drop restore card, confirm dialog, progress log.
- `src/lib/backup.functions.ts` *(new)* — `createBackup`, `parseBackupManifest`, `restoreBackup` server functions.
- `src/lib/backup.server.ts` *(new)* — schema introspection, jsonl streaming, zip building, restore planner. Server-only, imports `supabaseAdmin`.
- `src/components/admin/AdminShell.tsx` — add "Backup & Restore" sidebar entry.
- New storage bucket `backups` (private) + RLS policy "admins only" via migration.
- `package.json` — add `jszip`.

## Phase status update

Adds **Backup & Restore** as a new completed phase once shipped. Remaining work from earlier (emails, server-rendered cert PDFs, bulk CSV import, public corporate directory, live webhook E2E) is unchanged.

---

**Confirm before I implement:**

1. OK to add a private `backups` storage bucket for storing generated zips (so admins can re-download recent backups without re-running)?
2. On Overwrite restore, should the **currently-signed-in admin** be preserved automatically (recommended, avoids lockout)?
3. For cross-project restores, you'll run the restore from inside the destination project's admin page (same project's service role) — confirmed?  
  
answer to your confirmation:  
  
1.  yes please  
2.  yes  
3. yes.  
4.  add backup and restore progress animation 