## Goal

Harden signed-in sessions across both the member dashboard and the admin console: automatic idle timeout, hard session lifetime, visible device/session management with remote revoke, hijack detection, and a clean wipe of cached data on sign-out.

## 1. Idle timeout — 15 min inactivity + 60s countdown

A single `SessionGuard` component mounted once inside `AuthProvider` (so it covers every signed-in page, member and admin).

- Tracks activity: `mousemove`, `keydown`, `click`, `scroll`, `touchstart`, `visibilitychange` — throttled to one write per ~5s.
- Last-activity timestamp is stored in `localStorage` so **all open tabs share one timer** (activity in any tab keeps every tab alive).
- At 15 min idle: a modal appears — "Are you still there? You'll be signed out in 0:59" with **Stay signed in** / **Sign out now**.
- No response within 60s → automatic sign-out with reason `idle_timeout`; user lands on the correct login page (`/login` for members, `/admin/login` for console roles) with a toast: "You were signed out due to inactivity."
- "Stay signed in" refreshes the Supabase token and resets the timer.
- Timer only runs when a session exists; public pages are unaffected.

## 2. Absolute session lifetime — 12 hours

- Session start time recorded at sign-in. Once `now - session_start > 12h`, the user is signed out regardless of activity, with reason `absolute_expiry` and message "Your session has expired, please sign in again."
- Checked on a 60s tick and on tab focus, so a laptop woken after hours is signed out immediately rather than resuming.

## 3. Device / session registry + remote sign-out

New table `user_sessions`:

| column | purpose |
|---|---|
| `id` | session row |
| `user_id` | owner |
| `session_fingerprint` | hash of UA + platform + screen + timezone + language |
| `device_label`, `browser`, `os` | human-readable ("Chrome on Windows") |
| `ip_address` | captured server-side |
| `created_at`, `last_seen_at` | activity |
| `revoked_at`, `revoked_reason` | revocation |
| `is_current` | derived client-side |

- On sign-in a row is created (or refreshed) via a server function; a heartbeat updates `last_seen_at` every ~2 min while active.
- **Member view:** new "Active sessions" card on `/account/security` — list of devices with last-seen time, "This device" badge, **Sign out this device** and **Sign out all other devices**.
- **Admin view:** the same list per user in User Management, plus admin-side force-revoke (useful for a compromised staff account).
- Revocation is enforced client-side on each heartbeat: if the current session row is revoked, the app signs out immediately (max ~2 min lag).
- Each new device sign-in writes an `activity_log` entry ("New device sign-in — Chrome on Windows, Accra") so it shows in the notification bell / audit log.

## 4. Hijack / anomaly detection

- The heartbeat sends the current fingerprint + server-observed IP. If the fingerprint for a live session row changes, or the IP jumps to a different network in a short window, the server marks the session `suspicious`.
- Behaviour: session is revoked and the user must sign in again, and an `activity_log` entry `session_anomaly` is recorded (visible to admins in the audit log).
- Fingerprint is a non-invasive hash — no third-party tracking library.

## 5. Full cache / storage purge on sign-out

Centralise sign-out in `AuthProvider.signOut()` so **every** exit path (menu, idle timeout, absolute expiry, remote revoke) does the same thing in order:

1. `queryClient.cancelQueries()` then `queryClient.clear()` — no 401 storms, no stale data restored by Back.
2. Mark the `user_sessions` row revoked.
3. `supabase.auth.signOut()`.
4. Remove app-owned `localStorage` / `sessionStorage` keys (renewal banner dismissal, chat widget state, activity timestamp, Supabase auth key).
5. `navigate({ replace: true })` to the right login route — protected pages stay off the back stack.
6. A `storage` event broadcasts sign-out so **other open tabs sign out too**.

## Technical details

**Migration**
- `CREATE TABLE public.user_sessions (...)` with GRANTs (`authenticated`: select/insert/update own; `service_role`: all), RLS: users see/revoke only their own rows; admin/superadmin/developer can select and revoke any.
- `revoke_user_session(_id uuid)` security-definer RPC enforcing that ownership/admin check.
- Index on `(user_id, last_seen_at desc)`.

**New files**
- `src/components/auth/SessionGuard.tsx` — idle timer, countdown modal, absolute-expiry check, heartbeat, cross-tab sync.
- `src/lib/session-registry.functions.ts` — `registerSession`, `heartbeatSession`, `revokeSession`, `listMySessions` (auth-middleware protected; IP read from request headers server-side).
- `src/lib/session-fingerprint.ts` — browser-safe fingerprint hash.
- `src/components/account/ActiveSessionsCard.tsx` — shared UI for member + admin views.

**Edited**
- `src/components/auth/AuthProvider.tsx` — centralised `signOut(reason)`, session-start tracking, mounts `SessionGuard`.
- `src/routes/account.security.tsx` and `src/routes/admin.account.security.tsx` — add Active Sessions card.
- `src/routes/admin.users.tsx` — per-user session list + force sign-out.
- `src/components/dashboard/DashboardLayout.tsx` / `AdminShell.tsx` — use the centralised sign-out.

**Not changed:** RLS on existing tables, login flows, roles, or any business logic. Supabase JWT refresh continues as-is — the idle/absolute rules sit on top of it.

**Trade-off worth knowing:** a 15-minute idle timeout will interrupt anyone slowly filling a long form (directory listing, application). The timer counts keystrokes as activity, so this only bites on genuinely idle tabs, but the value is easy to change later if members complain.
