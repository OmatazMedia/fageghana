# Plan — Phases 3–5 of the analysis document

Grouped so each phase ships end-to-end.

## Phase A — Directory access + Contact map (#5)

**Directory is dashboard-only**

- Current state: `/directory` route exists as a standalone page that redirects to `/login` if unauthenticated.
- Change: remove the standalone `/directory` route entirely. Add a **Directory** tab inside the member dashboard (`/dashboard`) so only signed-in members with an active subscription see it. Non-active members hit the existing renewal lock screen.
- Detail page (`/directory/$slug`) also moves under the dashboard shell and is gated the same way.
- Update any nav links (`SiteHeader`, footer) that still point to `/directory` — remove them from public nav.
- All directory details a member sent to the admin after it's approved,the slug to display each membership directory should be seen by other members. All complete details submitted should be displayed in a well structured layout. Member who don't have some details filled...those the layout will be hidden in the full members directory view/page

**Google Map on `/contact**`

- Embed a Google Maps iframe pinned to FAGE's Accra office (no API key needed for public embed URL).
- Address configurable — store the embed URL / lat-lng in a new `site_settings` table (single-row key/value) so admin can edit it later.

## Phase B — Role-gated dashboards (#6)

**What's already done**

- Admin landing page shows per-role KPIs and Quick Actions (hardcoded per role).
- Sidebar sections are gated by role.

**What remains — admin-configurable permissions**

- New table `role_permissions` keyed by `role` + `permission_key` (e.g. `view_members`, `view_backups`, `view_activity_log`, `view_reports`, `manage_directory`, etc.).
- New admin page `/admin/roles` where a superadmin/admin can toggle which permission keys each role gets — checkbox matrix.
- Sidebar + landing widgets read from `role_permissions` instead of hardcoded role checks. Superadmin/admin always see everything.
- Seeded defaults match current hardcoded gates so nothing breaks on rollout.

## Phase C — External backup providers (#7)

Remove reliance on Lovable Cloud storage for backups. Admin picks a destination and enters credentials.

**Data model**

- `backup_destinations` table: `id`, `provider` (`google_drive` | `aws_s3` | `dropbox` | `ftp` | `webhook`), `name`, `enabled`, `config` (jsonb, encrypted-at-rest via pgsodium isn't available — store as jsonb and mark secrets fields; document that admin should treat this table as sensitive), `is_default`.
- `backup_schedules.destination_id` foreign key so each schedule targets a destination.

**Admin UI — `/admin/backup` gets a "Destinations" tab**
Per provider, show a form with the exact fields needed + inline guide:

- **Google Drive** — OAuth2 refresh token flow. Fields: `client_id`, `client_secret`, `refresh_token`, `folder_id`. Inline guide links to Google Cloud Console → OAuth consent → create Desktop client → get refresh token via OAuth Playground. "Test connection" button verifies token and folder access.
- **AWS S3** — fields: `access_key_id`, `secret_access_key`, `region`, `bucket`, `prefix`. Guide links to IAM → create user with `s3:PutObject` on the bucket.
- **Dropbox** — fields: `app_key`, `app_secret`, `refresh_token`, `folder_path`. Guide links to Dropbox App Console.
- **FTP/SFTP** — fields: `host`, `port`, `username`, `password`, `path`, `use_sftp` toggle.
- **Generic Webhook** — fields: `url`, `auth_header`. POSTs the backup file as multipart.

**Runner**

- `src/lib/backup-runner.server.ts` extended: after building the ZIP, upload to the schedule's destination via the matching adapter (`uploadToGoogleDrive`, `uploadToS3`, etc.). Each adapter lives in `src/lib/backup-adapters/*.server.ts`.
- Failure → mark schedule `last_status='error'` with the provider's error message (already wired).

**Cron unchanged** — `pg_cron` still hits `/api/public/hooks/run-scheduled-backup`.

## Phase D — Editable chatbot knowledge base (#8)

- New table `chatbot_knowledge`: `id`, `section` (e.g. "About FAGE", "Membership Tiers"), `content` (markdown), `display_order`, `enabled`, `updated_at`.
- New admin page `/admin/chatbot` — CRUD sections, live preview of the compiled system prompt.
- `/api/chat` route: at request time, load all enabled rows ordered by `display_order`, concatenate into the system prompt (replacing the hardcoded `FAGE_SYSTEM_PROMPT` in `src/lib/chatbot-knowledge.ts`). Fallback to the current hardcoded prompt if the table is empty.
- Migration seeds the table with the existing hardcoded content so behaviour is identical on day one.

## Technical notes

- Google Drive uploads use `googleapis` npm package (Worker-compatible via `fetch`-based auth); if it pulls Node-only deps, fall back to raw REST calls to `https://www.googleapis.com/upload/drive/v3/files` with the refresh token → access token exchange done in the handler.
- S3 uploads use AWS SigV4 signed PUT via `fetch` (no SDK — the SDK is heavy and often Node-only on Workers).
- All destination credentials read/written only via `supabaseAdmin` from server functions; RLS blocks all client access.
- Encryption at rest: Supabase already encrypts the DB volume; we won't add app-level encryption here unless requested, but the destinations table is `service_role`-only.

## Suggested order of execution

1. Phase A (directory move + contact map) — small, unblocks the client's immediate ask.
2. Phase D (chatbot knowledge base) — small, high visible value.
3. Phase B (role permissions matrix) — medium.
4. Phase C (external backup destinations) — largest; ship one provider at a time (Google Drive first, then S3, then the rest).

Reply "go" to start with Phase A, or tell me a different order.