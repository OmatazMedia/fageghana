# Plan

## Part 1 — Persistent dashboard sidebar with active highlighting

**Problem:** The member dashboard's sidebar lives inline in `src/routes/dashboard.tsx`. Pages opened from the sidebar (e.g. `/account/security`, `/account/change-password`) navigate away to their own layout, so the dashboard sidebar disappears.

**Fix:** Extract the sidebar into a shared layout that all member-area pages use.

1. **New `src/components/dashboard/DashboardLayout.tsx**` — wraps children, renders the sidebar + top bar currently inline in `dashboard.tsx`. Items become real `<Link>`s with `useRouterState` to compute the active route. Tabs that are still in-page state on `/dashboard` (overview, subscription, certificate, etc.) link to `/dashboard?tab=<id>`; cross-route items (Account → `/account/security`, Change password → `/account/change-password`) link to those routes. Active state is matched by pathname + `?tab` search param. Active item gets the existing primary-bg highlight; mobile drawer behavior preserved.
2. `**src/routes/dashboard.tsx**` — replace the inline sidebar JSX with `<DashboardLayout>`. Drive `tab` state from `useSearch()` `?tab=` instead of `useState`, so deep links work. Keep all tab components untouched.
3. `**src/routes/account.tsx**` — replace its own header + mini-sidebar with `<DashboardLayout>` (admins keep their current `/admin` shell — only non-admin members see the dashboard sidebar; admins continue back to `/admin` via existing logic). The "Security" / "Change password" tabs render inside the layout's main slot via `<Outlet />`.
4. Audit other member-only routes that should sit inside the dashboard shell: `account.change-password.tsx`, `account.security.tsx` (already covered via `/account` outlet). `certificate/$id`, `receipt/$id`, `verify/$code` stay standalone (public/print views) — out of scope unless you want them wrapped too.
5. Active highlighting rule: `pathname === item.to` OR (`pathname === '/dashboard'` AND `search.tab === item.tab`).

## Part 2 — Scheduled auto-backups + auto-discovery of new tables

Auto-discovery already works (`admin_list_public_tables()` introspects `information_schema` each run), so any new table is automatically included — no change needed there. Only scheduling is missing.

### Database

- **New table `backup_schedules**` (admin-managed, RLS admin-only):
`id`, `enabled boolean`, `frequency text` ('hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'), `cron_expression text`, `retention_days int default 30`, `last_run_at`, `last_status text`, `last_error text`, `next_run_at`, timestamps.
- **New table `backup_runs**` (history log): `id`, `started_at`, `finished_at`, `status` ('success'|'error'|'running'), `size_bytes`, `path`, `tables_count`, `error_message`, `trigger` ('manual'|'scheduled').
- GRANTs + RLS (admin via `has_role`); `service_role` ALL for the cron route.

### Backup endpoint

- **New TanStack server route `src/routes/api/public/hooks/run-scheduled-backup.ts**`
  - POST, validates `apikey` header against `SUPABASE_ANON_KEY`.
  - Reads the active schedule, calls the existing backup logic (refactored shared helper from `backup.functions.ts` so the route and `createBackup` share one implementation), writes a `backup_runs` row, prunes backups older than `retention_days` from the `backups` bucket.

### pg_cron

- Enable `pg_cron` + `pg_net`.
- Single cron job `fage-scheduled-backup` running **every 15 minutes** that POSTs to the route above. The route itself decides whether a run is due (compares `now()` to `next_run_at`). This lets the admin change frequency in the UI without re-scheduling SQL.
- Configured via `supabase--insert` (not migration) because it embeds the project URL + anon key.

### Admin UI

- **Update `src/routes/admin.backup.tsx**` — add a "Schedule" card above the existing Create/Restore cards:
  - Toggle enable/disable
  - Frequency dropdown (Hourly / Daily / Weekly / Monthly / Custom cron) + time-of-day picker for daily/weekly/monthly
  - Retention days input
  - "Next run", "Last run", "Last status" readouts
  - Recent runs table (last 20 from `backup_runs`) with status badge + download link
- Two server fns in `backup.functions.ts`: `getBackupSchedule`, `updateBackupSchedule`, `listBackupRuns` (all admin-gated via `requireSupabaseAuth` + `has_role`).

### Auto-discovery confirmation

No code change needed — `admin_list_public_tables()` already enumerates every base table in `public` at backup time, so a new table added later is picked up on the next scheduled run.

## Files

**New**

- `src/components/dashboard/DashboardLayout.tsx`
- `src/routes/api/public/hooks/run-scheduled-backup.ts`
- Migration: `backup_schedules`, `backup_runs`, RLS, GRANTs

**Edited**

- `src/routes/dashboard.tsx` (use layout, tab from search param)
- `src/routes/account.tsx` (use layout)
- `src/routes/admin.backup.tsx` (schedule UI + runs history)
- `src/lib/backup.functions.ts` (extract shared runner; add schedule/runs server fns)

## Out of scope

- Wrapping public print pages (`certificate`, `receipt`, `verify`) in the dashboard layout.
- Off-site backup destinations (S3, Drive). Files remain in the `backups` bucket.
- Email/Slack notifications on backup failure (can add later).
- can you create a setting section to determine certificate format for each of the membership plan and  also make a provision for the starting point which can be updated for the new auto generation to take its point 