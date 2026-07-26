
## Scope

Three items from the FAGE analysis doc:

1. Role-based access — the 6 roles (admin, finance, ceo, developer, coordinator, superadmin) already exist in `AppRole` and are gated via `/admin/roles` (Phase B). No new role types needed; instead make sure they are all assignable from **User Management** and documented as separate dashboards via the existing `role_permissions` matrix.
2. Full **Activity Log** upgrade with pagination + filters (by user, by role, by event type, by date range).
3. Backup page — verify/refresh so any newly-added public tables are captured on the next run.

## 1. Roles: assignability + assignment UI

- In `/admin/users`, ensure the "Add Staff/Admin" role selector lists all 6 roles: `admin`, `superadmin`, `staff`, `finance`, `ceo`, `developer`, `coordinator`. (Members stay separate.)
- Confirm `/admin/roles` matrix already includes each of these (it does — staff/finance/ceo/coordinator/developer/member columns). Add `superadmin` info row noting "always full access".
- No new DB changes for the enum — `AppRole` already covers them.

## 2. Activity Log — full rebuild at `/admin/activity-log`

Backend (`src/lib/activity.functions.ts`):
- Replace `listActivityLog` with a paginated version returning `{ rows, total }`.
- Inputs: `page`, `pageSize` (default 25), `event_type?`, `user_id?`, `role?`, `q?` (search email/name), `from?`, `to?` (ISO dates).
- Join `activities` → `auth.users` (via admin client) → `user_roles` to expose user email + roles, so the UI can filter by role and show who did what.
- Keep admin-only guard.

Frontend (`src/routes/admin.activity-log.tsx`):
- Filters bar: event-type chips, role dropdown, user search (email/name substring), date range (from/to), Reset button.
- Table columns: When, Event, User (email + role badges), IP, User agent, Detail.
- Pagination controls (Prev / Next / page X of Y, page-size selector 25/50/100).
- Persist filter state in URL search params so shares/bookmarks work.
- Empty + loading states retained.

Access:
- Keep visible to admin/superadmin/developer (already gated in sidebar); add `developer` explicitly if missing.

Per-user history:
- Each member/admin already logs `sign_in`, `sign_out`, `password_reset_requested`, etc. via `fireActivity`. Add a small "My activity" section (read-only, last 20 entries) on the member dashboard's Account & Security page so users can see their own documented activities. Server fn `listMyActivity` (auth middleware, own `user_id` only).

## 3. Backup page — capture new tables

Current `admin_list_public_tables()` RPC already returns every base table in `public`, and `backup-runner.server.ts` iterates that list, so newly-added tables (e.g. `chatbot_knowledge`, `backup_destinations`, `role_permissions`, `site_hero_slides`, `site_partner_logos`, `directory_custom_field_defs`) are already picked up.

Actions on `/admin/backup`:
- Add a "Tables included in next backup" panel that live-queries `admin_list_public_tables()` and lists them with row counts (via `admin_dump_table` length) so the admin can visually confirm coverage.
- Show a "Last discovered N tables" badge on the schedule card.
- No schema change required.

## Technical notes

- Types: extend `listActivityLog` return type; update React Query key to include all filters.
- Route change: `admin.activity-log.tsx` gains `validateSearch` for the filter params.
- No new migration is strictly required; if we want durable filters on `event_type`, we can add an index on `activities(event_type, created_at desc)` and `activities(user_id, created_at desc)` — recommended for performance.

## Out of scope

- Other doc items already handled in earlier phases (Member ID format, Let's Talk fix, Support/Profile route fix, FAGE Academy/Clothing services, dev-only gating of Plans/Forms/Gateways, chatbot knowledge, map pin).
