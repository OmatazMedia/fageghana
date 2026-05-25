## Goal

- on the membership page when a plan is selected and  and paymentn is made, on the form part can the form be in steps instead of long page form. it can be in section. note that the form page can not be accessed directly. attempt to go directly should redirect such user to the homepage.
- admi should be able to set/change the price for each package and create more or delete any already. admin should have a setting to have the membership format when set all registration willtake the format to append for members
- add user managment -CRUD and the ability for the admin to change  the membership plan which should also take effect in their membership id
- Extend the member dashboard with four new feature areas, each with a corresponding admin page. Reuse the existing `event_rsvps` and `trade_opportunities` tables and add what's missing.

## 1. Events & RSVPs

Existing: `activities` (events) + `event_rsvps` table already exists with `user_id`, `activity_id` and a `members manage own rsvps` policy.

**Database (migration):**

- Add admin SELECT policy on `event_rsvps` so admins can see all attendees.
- Add unique constraint `(user_id, activity_id)` to prevent duplicate RSVPs.

**Member side — new tab in `src/routes/dashboard.tsx` "Events":**

- List upcoming activities (where `event_date >= now()`), each with date/location/spots and an RSVP / Cancel button.
- Show "My RSVPs" section listing events the user has RSVP'd to.

**Admin side — new route `src/routes/admin.activities.tsx` enhancement (or new `admin.event-rsvps.tsx`):**

- On each activity row, an "Attendees" button that opens a sheet listing members who RSVP'd (name, email, company, member_id, RSVP date) with CSV export.

## 2. Trade Opportunities Board

Existing: `trade_opportunities` table with admin manage + authenticated read policies.

**Database (migration):**

- New table `trade_opportunity_interests` (`id, opportunity_id, user_id, message, created_at`) with RLS: members insert/view own, admins view all.

**Member side — new tab in `dashboard.tsx` "Trade Opportunities":**

- Browse active opportunities (title, country, category, deadline, source). Filter by category/country.
- "I'm Interested" button opens a small dialog (optional message) and inserts into `trade_opportunity_interests`.
- "My Interests" subsection lists the user's expressed interests.

**Admin side — new route `src/routes/admin.trade-opportunities.tsx`:**

- CRUD for `trade_opportunities` (post buyer leads/RFQs, mark inactive, set deadline).
- Per opportunity: view list of interested members (name, company, member_id, message, date) + CSV export.

**Sidebar:** add "Trade Opportunities" item to admin nav in `admin.tsx`.

## 3. Member Directory

**Database (migration):**

- Add columns to `member_profiles`: `directory_visible boolean default false`, `directory_bio text`, `directory_website text`, `directory_logo_url text`.
- New RLS policy `Members view directory` on `member_profiles`: authenticated users can SELECT rows where `status = 'approved' AND directory_visible = true`, exposing only safe columns (enforce via a view).
- Create view `public.member_directory` selecting only `member_id, company_name, contact_name, industry, country, products_exported, directory_bio, directory_website, directory_logo_url, tier` from approved + visible profiles. Grant SELECT to `authenticated`.

**Member side:**

- New tab in `dashboard.tsx` "Directory" → searchable list with filters (industry, country, tier). Card per member.
- In existing "Profile" tab, add toggle "Show me in member directory" + bio/website/logo fields.

**Admin side — new route `src/routes/admin.directory.tsx`:**

- Override visibility per member (toggle), see counts.

## 4. Export Readiness Tracker

**Database (migration):**

- New table `readiness_checklist_items` (admin-managed master list): `id, category, label, description, weight int default 1, display_order, active`.
- New table `member_readiness_responses`: `id, user_id, item_id, status ('not_started'|'in_progress'|'complete'), evidence_doc_id (nullable fk to member_documents), notes, updated_at`. Unique `(user_id, item_id)`.
- RLS: members manage own responses; admins SELECT all. Admins manage checklist items; authenticated SELECT active items.
- Function `get_readiness_score(_user_id uuid)` returning weighted % complete.

**Member side:**

- Enhance the existing "Readiness Score" tab in `dashboard.tsx`: render checklist grouped by category, each item togglable to in_progress/complete with optional evidence document picker (existing `member_documents`) and notes. Show overall weighted score and per-category progress.

**Admin side — new route `src/routes/admin.readiness.tsx`:**

- CRUD checklist items (label, category, weight, order, active).
- Aggregate view: per-member readiness score table, filter by tier, drill-down to a member's responses.

**Sidebar:** add "Readiness" item to admin nav in `admin.tsx`.

## Cross-cutting

- All new admin routes wrapped in `AdminShell`, gated by `has_role(auth.uid(), 'admin')`.
- All member-side queries via `supabase` browser client (RLS does the gating); no server functions needed unless aggregation requires it (readiness score uses the SQL function).
- Sidebar updates in `dashboard.tsx` (member) and `admin.tsx` (admin) to surface the new tabs/pages.
- Notifications: when admin posts a new trade opportunity or new event, insert a broadcast `notifications` row (user_id = null) so members see it.

## Technical notes

- Migration is additive — no destructive changes.
- One new storage need: directory logos can reuse the existing `content` public bucket (folder `directory-logos/<user_id>/...`); no new bucket required.
- No new npm packages.

```text
Files touched:
  src/routes/dashboard.tsx              (+ Events, Trade, Directory tabs; enhance Readiness, Profile)
  src/routes/admin.tsx                  (sidebar additions)
  src/routes/admin.activities.tsx       (attendees sheet)
  src/routes/admin.trade-opportunities.tsx   (NEW)
  src/routes/admin.directory.tsx        (NEW)
  src/routes/admin.readiness.tsx        (NEW)
  supabase/migrations/<timestamp>_dashboard_extensions.sql  (NEW)
```