
# FAGE Website Analysis — implementation plan

Scope: apply every point from the uploaded analysis doc.

## 1. Roles & role-based access

Extend `app_role` enum: add `finance`, `ceo`, `developer`, `coordinator`, `superadmin` (keep existing `admin`, `staff`, `member`).

Single admin dashboard (`/admin`), sidebar + route access filtered by role via `has_role()` checks:

| Section | Visible to |
|---|---|
| Members, Applications, Directory, Resources, News, Media, Notifications, Site Media, Tickets | admin, superadmin |
| Payments, Invoices, Reports | finance, admin, superadmin, ceo (read-only for ceo) |
| Everything (read) | ceo, superadmin |
| Plans, Forms, Form builder, Gateways, Email settings, Email templates, Activity log, Backup, User Management | developer, superadmin only |
| Certificates, Cert-batch, Cert-issued, Readiness | admin, coordinator, superadmin |
| Trade opportunities | coordinator, admin, superadmin |

Add a `RoleGuard` component and a `visibleForRole()` helper in `src/routes/admin.tsx` sidebar. Update User Management to allow assigning any of the new roles.

## 2. Admin dashboard fixes

- **Readiness tab**: add tooltip explaining weight (used in score calc) and add a `display_order` column + drag handles on `readiness_checklist_items`.
- **Issued Certificate tab**: fix the "Back to dashboard" button on the review-cert screen — currently points to `/dashboard`, change to `/admin/cert-issued`. Fix `Verify` action — currently opens the public site and passes no code; change to open `/verify/{code}` in a new tab.
- **User Management** (`admin.users.tsx`):
  - Move `Bulk invite members` button out of the Staff/Admin section — Staff/Admin tab shows only `Add Staff/Admin`.
  - Add `Bulk invite members` + CSV import (email, name, company, phone, tier) inside the Members tab.
- **Account & Security vs Change Password**: `/account/security` currently redirects to the same page as change password. Split them:
  - `/account/security`: MFA, active sessions, connected providers, security events log.
  - `/account/change-password`: password change form only.
- **Support & Profile** in admin sidebar: currently link to member `/dashboard`. Point Support → `/admin/tickets`, Profile → `/account`.

## 3. Backup & Restore

- Create private Storage bucket `backups` (Lovable Cloud).
- Update `backup-runner.server.ts` to upload the generated ZIP to `backups/{schedule_id}/{timestamp}.zip` in addition to writing to `backup_runs`. Store the storage path on `backup_runs.storage_path`.
- Admin Backup page: after a successful run, offer both (a) download the CSV bundle to the local machine (existing) and (b) a link/notice that a copy was uploaded to cloud storage.
- Keep the pg_cron-driven scheduler; add a default 2-day schedule if none exists.
- Move Backup page under Developer/Superadmin role only.

## 4. Plans & Member ID generator

- Add settings on `subscription_plans` for `id_abbreviation` (AS/CR/SB per plan).
- New DB function `generate_member_id(tier_abbrev, year)` producing `FAGE/{ABBR}/{YY}/{NNNNN}` where `NNNNN` is the sequential order within (year, abbrev). Uses a new `member_id_counters(year_abbrev PK, next_seq)` table with row-level lock.
- Trigger on `member_profiles.status` becoming `approved` sets `member_id` if null using the enrolled year.
- Admin edit form on Members allows manual override / manual assignment for legacy records.
- Existing member IDs are left as-is (per your choice).

## 5. Activity log

- Existing `activities` table already logs some events. Extend with: `ip_address`, `user_agent`, `event_type` (login/logout/password_reset/profile_update/etc.).
- Client middleware in `AuthProvider` records `login` and `logout` via a new `log_activity` server fn (captures IP via request headers on the server side).
- New route `/admin/activity-log` (Developer/Superadmin only) with filters by user, date, event.

## 6. Main website map

- Update the Google Map embed on `contact.tsx` (and any other page using it) to use FAGE's precise coordinates with a labelled marker. I'll use a `google.com/maps/embed` iframe centered on the coordinates and pinning "FAGE — Federation of Associations of Ghanaian Exporters".
- **Need from you**: exact FAGE office address / GPS to pin. If not provided, I'll use "Federation of Associations of Ghanaian Exporters, Accra" and you can refine later.

## 7. Main website copy & nav

- **"Let's Talk" button**: change target from `/membership` (join) to `/contact`. Fix in `SiteHeader.tsx`, homepage hero, footer CTA.
- **Services page**: add two service cards — **FAGE Academy** and **Clothing & Textile Products** — with placeholder copy and icons; each links to an anchor on the services page (or `#academy`, `#textiles` sections).
- **Footer**: remove developer credit/hyperlink from `SiteFooter.tsx`.

## 8. Chatbot

- Extend `ChatWidget.tsx` to call a new `/api/chat` server route.
- Build system prompt from static FAGE knowledge (About, Services, Membership tiers/pricing, Contact) compiled in `src/lib/chatbot-knowledge.ts` (extracted from current site content).
- Uses Lovable AI Gateway with `google/gemini-3-flash-preview`.
- Fallback rule in the system prompt: if the user's question is outside FAGE topics or the bot is unsure, respond with "I'll route your question to the FAGE team" and call a `submit_chat_escalation` server fn that creates a `support_ticket` (which surfaces in the appropriate staff's Notifications).

## Technical details

### DB migration (single)

```sql
-- Roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'ceo';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Member ID
CREATE TABLE public.member_id_counters (
  year_abbrev text PRIMARY KEY,
  next_seq int NOT NULL DEFAULT 1
);
GRANT SELECT ON public.member_id_counters TO authenticated;
GRANT ALL ON public.member_id_counters TO service_role;
ALTER TABLE public.member_id_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read counters" ON public.member_id_counters FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.generate_member_id(_abbrev text, _year int) ...;

ALTER TABLE public.subscription_plans ADD COLUMN id_abbreviation text;

-- Activity log
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS event_type text;

-- Backup storage path
ALTER TABLE public.backup_runs ADD COLUMN IF NOT EXISTS storage_path text;

-- Readiness ordering
ALTER TABLE public.readiness_checklist_items
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;
```

### New files
- `src/lib/chatbot-knowledge.ts` — FAGE system prompt
- `src/routes/api/chat.ts` — streaming AI route
- `src/lib/activity.functions.ts` — log_activity, list_activity
- `src/routes/admin.activity-log.tsx`
- `src/components/admin/RoleGuard.tsx`

### Modified files
- `src/routes/admin.tsx` — role-filtered sidebar, fix Support/Profile links
- `src/routes/admin.users.tsx` — split Bulk invite by tab
- `src/routes/admin.cert-issued.tsx` — fix back button + Verify link
- `src/routes/admin.readiness.tsx` — weight tooltip + ordering
- `src/routes/account.security.tsx` and `account.change-password.tsx` — split content
- `src/routes/contact.tsx` — map with FAGE pin
- `src/routes/services.tsx` — add FAGE Academy + Textiles
- `src/components/site/SiteHeader.tsx` — Let's Talk → /contact
- `src/components/site/SiteFooter.tsx` — remove dev credit
- `src/components/site/ChatWidget.tsx` — wire to /api/chat
- `src/lib/backup-runner.server.ts` — upload ZIP to `backups` bucket
- Member creation flow — call `generate_member_id` on approval

## Open items

1. FAGE exact office address / GPS for the map pin — please provide or confirm using "Accra, Ghana, GA-XXX-XXXX".
2. Existing admin/staff users: should they keep `admin`/`staff` roles, or should I offer a UI to reassign them to the new granular roles now?
