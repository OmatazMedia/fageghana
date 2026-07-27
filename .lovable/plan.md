# Status vs. FAGE_WEBSITE_ANALYSIS.docx

Most items from the doc have been addressed in earlier turns. Below is a checklist of what's done and what still remains.

## Already done ✅

- Readiness tab — weight tooltips + display-order controls
- User Management — "Add staff / admin" on Users page; Bulk invite (CSV) lives on Members page
- Account & Security vs Change Password — split into separate routes (member + admin)
- Support & Profile admin links — pointed at `/admin/*` routes
- Plans, Form builder, Gateways, Email settings/templates — gated to developer/superadmin
- Member ID format `FAGE/{ABBR}/{YEAR4}/{SEQ5}` (AS/CR/SB)
- Role-based access — admin, finance, CEO, developer, coordinator, superadmin with permission matrix
- Google Map — FAGE pin
- Header "Let's Talk" → `/contact`
- FAGE Academy + Clothing & Textile added to Services
- Developer credit removed from footer
- Chatbot knowledge base + ticket fallback

## Still outstanding ❌

### 1. Issued Certificates — "Verify" column button

Doc says clicking Verify from the cert row and typing name/ID/company returns "Data not found." The row link goes to `/verify/$code` which expects the certificate verification code, not the member fields — but the search side of `/verify` uses `public_search_members` which may be filtering out records that lack a published directory entry. Need to (a) confirm the row-level "Verify" button jumps straight to the certificate result (skip the search UI), and (b) fix `public_search_members` so any approved member with a member_id/company/name is findable regardless of directory entry status.

### 2. Certificate review — "Back to dashboard" button

`certificate.$id.tsx` already branches on `isAdminUser`, but the button label still reads "Back to dashboard" for admins. Rename to "Back to Issued Certificates" (and keep the `/admin/cert-issued` href) so it's unambiguous.

### 3. Backup & Restore — redundant local CSV

Currently the manual/scheduled runs produce a ZIP (JSON per table). Doc asks for a redundant **CSV** artifact on the machine that initiated the backup. Add a per-table CSV export alongside the ZIP: the manual "Download backup" action produces a `.zip` containing both `*.json` and `*.csv` for every table, and scheduled runs attach the same bundle to the Google Drive upload.  
  
you can leave the zip but add an email to recieve the copy of the backups in the email added by the admin.

### 4. Activity log — IP address, device, event details

The `activities` table had `ip_address`, `user_agent`, and `event_type` dropped for a security finding, but the doc explicitly requires IP + device + event type visible on the developer dashboard. Re-introduce those columns on a **separate** admin-only table (`activity_audit`) with RLS locked to `developer`/`superadmin` only (never exposed to `authenticated`), and log auth events (login, password reset, profile changes) into it. Surface it on `/admin/activity-log` behind a developer-only tab.

### 5. Hero "Let's Talk"/CTA button link ordering

The homepage hero button now honors `cta_href`, but the doc's original complaint was that slides load in the wrong order on first paint. Confirm slides are queried `order by display_order asc nulls last` and that the first paint uses index 0 of that ordered array (no state race). leave the lets talk t the contact page.

when the certificate "Verify" is clicked from the admin dashboard, it loads link like this "/verify/FAGE-SB-0026-00001-2FB594" but does not show the details for the certificate to be verified, but shows the page "/verify" waiting for the user to still enter the details. its ment to skip all of that and show the details for the certificate to be verified. fix that

## Technical notes

- **CSV export**: use `PapaParse` (already in tree if not, add it) inside `backup-runner.server.ts`; write both `table.json` and `table.csv` into the same ZIP.
- **activity_audit table**: `id uuid pk, user_id uuid, event_type text, ip inet, user_agent text, meta jsonb, created_at timestamptz`. Grants: `service_role` only; RLS policy `select` for `has_role(auth.uid(),'developer') OR has_role(auth.uid(),'superadmin')`. Populate from a lightweight server-fn `logAuditEvent` called from auth flows.
- **verify search RPC**: change `public_search_members` to search `member_profiles` by `member_id/company_name/contact_name/email` where `status='approved'` (drop the join to `directory_entries`).
- **cert row Verify button**: it already links to `/verify/$code`; keep as-is but ensure `verify_certificate` returns rows even when subscription is expired (doc's "displays Data not found" hints the RPC filters those out).

## Suggested build order

1. Verify RPC + row-Verify + certificate back-button label (small, one migration + two edits)
2. Redundant CSV in backup ZIP
3. `activity_audit` table + developer-only tab

Confirm and I'll execute in that order.