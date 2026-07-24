## Status vs. the client's analysis document

Already done (from earlier turns): Let's Talk → /contact, FAGE Academy & Clothing/Textile added to services, "Developed by Omataz" removed, chatbot with FAGE knowledge + ticket escalation, activity log route + capture (login/logout/reset/profile updates), granular admin roles (finance, ceo, developer, coordinator, superadmin), sidebar section gating by role, Bulk Invite moved to Members page, contact-page map pin fix, cert "Back" button referrer heuristic.

Still outstanding (this plan):

### Root cause of "some logins get to another"

The admin sidebar's **Account & Security** and **Support / Profile** links point at `/account/security` and member routes, which are wrapped in `DashboardLayout` (the member sidebar shell). So when an admin clicks them, the URL changes into the member dashboard shell — indistinguishable from "being logged into the wrong portal". Same class of bug for the Issued Certificate "Back to dashboard" button, which falls back to the member dashboard when the referrer is missing.

Fix: give admins their own account routes under `/admin/account/*` that reuse `AdminShell`, and route the sidebar footer + cert back-button through role-aware navigation instead of a shared `/account/*` layout.

---

## Phase 1 — Cross-portal navigation bugs (highest priority, client-flagged)

1. **Admin account pages under `/admin**`
  - New routes: `/admin/account/security` and `/admin/account/change-password` that render the existing Security / Change-Password panels inside `AdminShell` (not `DashboardLayout`).
  - Sidebar footer link in `src/routes/admin.tsx` → `/admin/account/security`.
  - Add a small "Account & Security" and "Change Password" entry under a new *Personal* group at the bottom of the admin nav so admins never leave the admin shell.
2. **Issued Cert "Back" and "Verify" buttons** (`src/routes/certificate.$id.tsx`, `src/routes/verify.tsx`, `src/routes/admin.cert-issued.tsx`)
  - Back button: if the current user has any admin-console role, always return to `/admin/cert-issued`; else `/dashboard`. Stop relying on `document.referrer`.
  - Public verify page currently accepts only the verification code. Extend the form to also search by **Member ID**, **name**, or **company** via a `verify_member_public` RPC that returns non-PII fields (name, member_id, tier, status, expiry). Show a friendly result card instead of "Data not found" when the query is empty.
3. **Member-side "Account & Security" vs. "Change Password" duplicate**
  - Audit `DashboardLayout` sidebar: today both sidebar links land on `/account/security` because `/account` redirects there. Point "Change password" at `/account/change-password` and confirm the security page no longer embeds the password form (it currently does, causing the "same page" complaint).

## Phase 2 — Member ID, developer-only gating, admin UX polish

4. **Member ID format `FAGE/AS/YYYY/00001**`
  - Migration: rewrite `generate_member_id(_tier)` to emit `FAGE/AS|CR|SB/YYYY/NNNNN` with 4-digit year and zero-padded 5-digit sequence, using the existing `member_id_counters` per-year row (reset yearly). `standard` → `SB`.
  - Backfill: leave existing IDs untouched; only new issuances use the new format.
5. **Developer-only route gates** (already hidden from nav, but the URLs are still reachable)
  - Add `beforeLoad`/component-level guard on `/admin/plans`, `/admin/forms`, `/admin/gateways`, `/admin/email-settings`, `/admin/email-templates`, `/admin/backup`, `/admin/activity-log`, `/admin/users` — redirect to `/admin` when the user lacks `developer` or `superadmin`.
6. **User Management page layout**
  - Move "Add Staff/Admin" button to top-right of the staff-members table.
  - Remove any bulk-invite affordance from this page (bulk invite lives on Members page only, per prior turn — verify none remains here).
7. **Readiness tab clarification** — add small helper tooltips explaining what *Weight* and *Display order* do (client asked why they exist rather than requesting a change).

## Phase 3 — Backup redundancy + role dashboards

8. **Backup: cloud + local CSV redundancy**
  - Extend `backup_schedules` with a `deliver_local_csv` boolean.
  - When a scheduled or manual run completes, in addition to the existing cloud upload, generate a per-table CSV bundle (zip) and expose a "Download last run" button on `/admin/backup` that streams the bundle from a signed URL.
9. **Per-role landing dashboards** (soft-separation, not separate apps)
  - `/admin` currently shows one Overview. Add role-scoped overview cards so Finance sees payments KPIs, CEO sees membership KPIs, Coordinator sees events/trade KPIs, Developer sees system health + activity log summary. Sidebar filtering already exists; this closes the "separate dashboard" ask without forking the shell.
10. **Activity log completeness** — audit remaining mutation surfaces (member CRUD, directory approve/suspend, payment confirm, backup run) and ensure each calls `logActivity` so the Developer's Activity Log reflects "everything that happens on the system".

---

### Technical notes

- New admin account routes reuse existing components from `src/routes/account.security.tsx` and `src/routes/account.change-password.tsx` — extract their panels into `src/components/account/*` and mount them from both `/account/*` (member shell) and `/admin/account/*` (admin shell). No behavior change, just shell selection.
- Verify-by-name RPC must be `SECURITY DEFINER`, return only public columns, and be granted to `anon` — the search page is public.
- Member ID migration must run in a single transaction and keep the existing `member_id_counters` table; only the formatter changes.

### Suggested order of execution

Phase 1 first (fixes the reported "logs into another portal" symptom), then Phase 2, then Phase 3. Each phase is independently shippable.  
  
  
when i add a new banner the button link entered is not what the button is on the front end fix please

&nbsp;