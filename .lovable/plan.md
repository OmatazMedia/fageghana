## Goal
Replace the standalone "Sign out" button in both the admin and member dashboard top bars with a clickable avatar menu, and add a bell notification icon with a dropdown that shows a unified feed of relevant events.

## 1. Top bar: avatar menu (both dashboards)

**Admin** (`src/routes/admin.tsx`, header block ~lines 361-378)
- Remove the standalone `<LogOut> Sign out` button.
- Wrap the avatar + name in a button that toggles a dropdown containing:
  - Profile (→ `/admin/account/security`)
  - Change password (→ `/admin/account/change-password`)
  - Sign out (calls `handleSignOut`)
- Close on outside click / Esc / route change.

**Member** (`src/components/dashboard/DashboardLayout.tsx`)
- The avatar menu already exists in the top bar (View profile / Account & security / Sign out) — leave it, but:
  - Remove the "Sign out" button that lives at the bottom of the sidebar (lines ~162-172) so sign-out only lives in the avatar dropdown, matching admin.
  - Keep the "View site" link in the sidebar.

## 2. Bell notification icon (both dashboards)

Add a bell button to the immediate left of the avatar in both top bars. Clicking opens a dropdown panel (max-height with internal scroll) that shows a unified, time-sorted feed.

**Shared component:** new `src/components/notifications/NotificationBell.tsx`
- Props: `scope: "admin" | "member"`.
- Uses TanStack Query with a 30s refetch; also subscribes to Supabase realtime on the underlying tables so new items appear without reload.
- Renders unread badge count, "Mark all as read" action, and per-item "mark read" on click.
- Each item: icon (by type), title, one-line context, relative time, click → deep link.

**Feed sources**

Member scope (filtered to the current `user_id`):
- `notifications` (existing direct + broadcast) → title/body, link to `/dashboard?tab=notifications`.
- `payment_submissions` status changes for this user → link to `/dashboard?tab=invoices`.
- `ticket_messages` on tickets owned by this user where sender ≠ self → link to `/dashboard?tab=support`.
- Login notice: on successful sign-in, `AuthProvider` already writes `activity_log` (`sign_in`) — surface the most recent one as a "Signed in from …" item for the current user.
- Subscription expiry reminder: derived client-side from `member_profiles.subscription_expiry` when < 30 days.

Admin scope (visible to admin / staff / superadmin / relevant roles):
- New `membership_applications` (status = pending) → `/admin/applications`.
- New `payment_submissions` (status = pending/awaiting review) → `/admin/payments`.
- New `contact_messages` (unread) → `/admin/tickets` or dedicated section.
- New `support_tickets` + latest `ticket_messages` from members → `/admin/tickets`.
- New `directory_entries` with status = pending → `/admin/directory-entries`.
- New member registrations (`member_profiles` rows created in last N days) → `/admin/members`.
- Recent notable `activity_log` events (sign_in_failed spikes, password_reset_requested) → `/admin/activity-log`.

Role gating on the admin bell uses the existing `useRolePermissions` / `hasAnyRole` so, e.g., finance-only users see payments but not tickets.

**Read state**

- Add lightweight per-user read tracking via a new `notification_reads` table (see technical details) so "unread" is durable across sessions and devices without mutating the source tables.

## 3. Wiring events into the feed

No new event emitters are required for MVP — every source table above is already written to by existing flows (applications, payments, tickets, contact form, directory submissions, auth activity). The bell reads from them directly, so new sign-ins, submissions, and registrations show up automatically.

## Technical details

- New file: `src/components/notifications/NotificationBell.tsx` — self-contained, uses `supabase` client, `useAuth`, `useQuery`, and `supabase.channel(...)` for realtime.
- New file: `src/lib/notifications.ts` — pure helpers that map each source row to a `FeedItem { id, type, title, subtitle, href, createdAt, sourceTable, sourceId }`, plus admin/member fetchers combining the queries with `Promise.all` and merging by `createdAt desc, limit 50`.
- Admin header edit: `src/routes/admin.tsx` header (~L361-378) — inject `<NotificationBell scope="admin" />`, replace sign-out button with avatar dropdown (reuse the pattern already in `DashboardLayout`).
- Member layout edit: `src/components/dashboard/DashboardLayout.tsx` — inject `<NotificationBell scope="member" />` next to the existing avatar button; remove the sidebar Sign out button.
- New migration for read state:

```sql
CREATE TABLE public.notification_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_table text NOT NULL,
  source_id text NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_table, source_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reads" ON public.notification_reads
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- No changes to existing RLS on source tables; admin queries rely on existing admin/staff SELECT policies already in place.

## Out of scope
- Email/push notifications.
- New audit events beyond what's already logged.
- Redesigning the notifications tab page (bell links to it).
