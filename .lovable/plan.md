## Phase: Fixes & New Member Onboarding Flow

### 1. Backup → Restore: diagnose & fix
- Wrap `restoreBackup` server fn in a try/catch that returns `{ ok:false, step, message, stack }` instead of throwing the generic React error boundary.
- Surface real server error in the UI restore log (not just toast "Something went wrong").
- Add granular `log.push(...)` per step (parse manifest, apply enums, apply tables, apply policies, restore data per table, restore auth, restore storage). Catch per-step so one failure shows exactly where.
- Likely root causes to patch:
  - `admin_exec_sql` rejects multi-statement strings → split SQL on `;` and execute one statement at a time.
  - JSONL parse errors when bucket files are not text → handle binary by skipping non-JSONL paths.
  - Missing `admin_list_sequences` SQL block on overwrite restore.
- After fix: re-run a small backup, restore in merge mode, confirm tables refilled.

### 2. Certificate admin: separate the three pages
Cause: `admin.certificates.tsx` is the parent of `admin.certificates.issue.tsx` and `admin.certificates.issued.tsx`, so the Designer renders as the layout for both child pages.
- Rename routes so they are siblings, not children:
  - `src/routes/admin.certificates.tsx` → `src/routes/admin.cert-designer.tsx` (path `/admin/cert-designer`)
  - `src/routes/admin.certificates.issue.tsx` → `src/routes/admin.cert-batch.tsx`
  - `src/routes/admin.certificates.issued.tsx` → `src/routes/admin.cert-issued.tsx`
- Update the sidebar in `src/routes/admin.tsx` and any internal `<Link to="...">` references.
- Result: each page is fully independent — no shared layout bleed.

### 3. Certificate Designer enhancements
- **Per-field on/off toggles**: store a `visible: boolean` per field key in `field_positions` (default true). Add a checkbox in the field list. Renderer (`src/lib/certificate-render.ts`) skips fields where `visible === false`.
- **Up to 3 named signatures**:
  - Migration: add `signatures jsonb DEFAULT '[]'` to `certificate_templates` (each entry: `{ url, name, x, y, width }`). Keep legacy `signature_url`/`authorized_name` for backward compatibility — render falls back to `signatures[0]` when present.
  - Designer UI: a "Signatures" section with up to 3 slots. Each slot: image upload (required to enable that slot), free-text signatory name, drag handle on canvas.
  - Renderer: draw each signature image at its slot position with the signatory name printed beneath the line — name does NOT appear anywhere else on the certificate (not appended to body/title).

### 4. New "Apply" funnel: pay first → autofill → submit → auto account → first-login experience

#### 4a. Anonymous-friendly apply page (`/apply/:tier`)
- Remove the "must be logged in" gate at the top of `apply.$tier.tsx`.
- Step 1 (always shown to anonymous): mini form — Full name, Email, Phone — then choose payment gateway.
- `initPaystack` / `initHubtel` server functions: accept anonymous calls, create a `payment_submissions` row owned by a placeholder identity tied to the email; metadata carries `name/email/phone/tier`.
- Migration: relax `payment_submissions.user_id` to allow NULL for anonymous applicants; add `applicant_email`, `applicant_name`, `applicant_phone` columns; loosen INSERT RLS via a server fn rather than direct client insert.

#### 4b. Payment callback → auto account creation
Extend `paystack-webhook.ts` and `hubtel-callback.ts` (or wrap in a shared `finalizePayment` helper):
1. Mark payment confirmed.
2. If no auth user with that email: `supabaseAdmin.auth.admin.createUser({ email, password: <generated>, email_confirm: true, user_metadata:{ must_change_password: true, first_login: true } })`. Password = first name (lowercased, alnum) + 4 random digits.
3. Insert `member_profiles` row + generate `member_id` (existing RPC).
4. Send welcome email via Lovable Emails (template `welcome-member` with `{ name, email, password, member_id, login_url }`) — agent will set up email infra + scaffold the template.
5. Insert a row in new `account_credentials_seed` table (`user_id`, `temp_password_hash`, `delivered_at`) for audit; or just rely on the email.

#### 4c. Form auto-fill after payment (post-payment redirect)
- Apply page `/apply/:tier` after redirect with `?payment=success&ref=...`:
  - Sign the new user in automatically (one-time via `supabase.auth.signInWithPassword` using the temp password returned through a short-lived signed token from the webhook callback page) **OR** require email verification first.
  - Pre-fill DynamicForm with `name`, `email`, `phone` from the payment record; fields remain editable.
  - On submit → insert `application_submissions`, link `payment_id`.

#### 4d. Forced password change on first login
- New route `/first-login` (or use existing `/reset-password`): if `user.user_metadata.must_change_password === true`, redirect there before dashboard. After successful update, set `must_change_password=false`.
- Auth-guarded layout (`_authenticated` style or `dashboard.tsx`) checks the metadata flag.

#### 4e. Welcome modal + confetti (first login ever)
- On dashboard mount, if `user.user_metadata.first_login === true` AND `must_change_password === false`:
  - Show modal "Welcome to FAGE — brief things to know" (content sourced from new `site_settings.welcome_brief` text, editable in admin).
  - Fire `canvas-confetti` once.
  - Set `first_login=false` via `supabaseAdmin.auth.admin.updateUserById` through a small server fn.
- Auto-issue a certificate at this point if none exists (generate from the active template for the user's tier; show in dashboard immediately).

### 5. Admin: editable email templates + welcome brief
- New page `/admin/email-templates`:
  - List all transactional templates registered (welcome-member, password-reset-confirmed, certificate-issued, payment-received).
  - For each: editable subject + Markdown body with token chips: `{{name}}`, `{{member_id}}`, `{{password}}`, `{{login_url}}`, `{{tier}}`.
  - Storage: new `email_templates` table (`key`, `subject`, `body_md`, `updated_at`).
  - Welcome message logic in webhook reads from this table at send time (falls back to a built-in default).
- Welcome modal text: stored in the same admin page or a `site_settings` row.

### 6. Email infrastructure
- Run email-domain setup (Lovable Emails) → scaffold transactional templates → register `welcome-member` template that pulls subject/body from the DB row above (template renders `templateData` injected at send time).

---

## Technical notes (for the agent)

**Files touched (high-level):**
- Backup: `src/lib/backup.functions.ts`, `src/routes/admin.backup.tsx`.
- Cert routes rename: 3 file moves + `src/routes/admin.tsx` sidebar + cert-render lib.
- Migrations: `certificate_templates.signatures jsonb`, `payment_submissions` nullable user_id + applicant fields, new `email_templates`, new `site_settings` row.
- Apply funnel: `src/routes/apply.$tier.tsx`, `src/lib/payments.functions.ts`, `src/routes/api/public/paystack-webhook.ts`, `src/routes/api/public/hubtel-callback.ts`, new `src/lib/onboarding.functions.ts` (server fn for first-login flag flip + cert auto-issue).
- New routes: `/admin/email-templates`, `/first-login`.
- Welcome modal + confetti: `src/routes/dashboard.tsx` + `bun add canvas-confetti`.
- Email: `email_domain--setup_email_infra` + `email_domain--scaffold_transactional_email` + `src/lib/email-templates/welcome-member.tsx`.

**Order of work:** 1 → 2 → 3 → 5 (templates table) → 4 (depends on email) → 6.

---

## Remaining phases (after this batch)
- Public corporate member directory page.
- Server-rendered certificate PDFs (current is canvas-based, no SSR PDF).
- Bulk CSV member import.
- Live webhook end-to-end test against Paystack/Hubtel sandbox.
- Public REST API for verifying certificates by code (partially in `verify.$code.tsx`).
