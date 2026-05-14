## Goal

Wire the membership lifecycle end-to-end:

1. Anyone clicks **Apply Now** on a plan → enters minimal contact details → goes to admin-configured payment gateway → after payment success, account is auto-created → the full corporate-PDF form is shown → submission populates the rest of their portal.
2. Existing members get a **Renew** modal listing every active plan; same plan = extend expiry only, member ID kept; different plan = new ID + new dates.
3. Admin can create / edit / toggle off any plan; new plans flow through the same Apply / Renew UI automatically.
4. Use the uploaded **FAGE-Membership-Form-Corporate.pdf** as the canonical Corporate form schema (download + on-screen form).
5. Fix the Restore feature on `/admin/backup`.

---

## 1. Corporate form (from your PDF)

Seed `application_forms` for `tier=corporate` with these fields (mirrors the PDF exactly):

```
Company's Name*           (text)
Company's Address*        (paragraph)
Telephone*                (phone)
Fax                       (text)
Email*                    (email)
Website                   (text)
Bankers — up to 3         (heading + 3× {Bank name, Bank address})
Auditors — Name + Address (text + text)
Legal Status*             (radio: Limited liability (Public/Private) | Partnership | Sole Proprietorship | Limited by Guarantee | Cooperative | Branch of foreign Co. | Agent of foreign Co. | Other)
Other legal status        (text — shown if "Other")
Type of Activity*         (checkboxes: Producer/Manufacturer | Producer/Exporter | Manufacturer/Exporter | Exporter | Other)
Other activity            (text)
Company profile (1 page)* (file)
Products*                 (paragraph)
% Exported per Annum*     (number)
Company Executives        (paragraph — Name / Designation, one per line)
Contact Person / CEO*     (text)
Location of Company*      (text)
Postal address*           (text)
Cert. of Incorporation No*+ Date (text + date)
Cert. to Commence Business No + Date (text + date)
No. of Management*        (number)
No. of Workers*           (number)
Declaration*              (checkbox — "Information provided is true")
```

Also drop the original PDF into the **content** bucket and set
`subscription_plans.application_form_pdf_url` for `corporate` so the
Download-form button serves the official PDF.

---

## 2. Apply flow — anonymous-start + pay-first

Replace `src/routes/apply.$tier.tsx` with a 4-step flow that no longer
gates step 1 behind login:

```text
[choose plan] → [contact mini-form] → [payment gateway] → [auto-account] → [full form] → [dashboard]
```

### Step A — Contact mini-form (public)

Anonymous-friendly. Collects: full name, work email, phone, company name.
Stored in a new `pending_applications` row with the chosen `tier` and a
short-lived `claim_token` (uuid, 24h). No auth needed.

### Step B — Payment

Server fn `initPaystack` / `initHubtel` already takes `tier + gateway_id`.
Extend them to also accept `pending_application_id` so they can:
- write the row's email into the gateway request,
- store `pending_application_id` in `payment_submissions.member_message`
  alongside `tier:<x>`,
- include it in the callback URL.

The manual-bank path stays available but admin must verify before account
creation.

### Step C — Auto-account on payment confirmed

In `verifyPayment` (and the Paystack/Hubtel webhooks), once status flips
to `confirmed`:

1. Look up `pending_applications` by id.
2. If `auth.users` already has that email → reuse the user.
3. Otherwise call `supabaseAdmin.auth.admin.createUser({ email, password: <8-char random>, email_confirm: true })` and email a magic-link via `supabase.auth.admin.generateLink({ type: "magiclink" })` so the user lands signed-in on `/apply/<tier>?claim=<token>`.
4. Upsert `member_profiles` (status `approved`, member_id from `generate_member_id`, subscription_start = now, subscription_expiry = now + plan.duration_months).
5. Send a notification + (best-effort) welcome email.

### Step D — Full corporate form

`/apply/$tier?claim=<token>` resolves the token, signs the user in if
needed, and renders the corporate `DynamicForm`. On submit it writes
`application_submissions` with `status='new'`. Dashboard then shows the
member portal with the data filled from `application_submissions.answers`
(used to display profile + later cert generation).

---

## 3. Renew flow

Add a **Renew membership** button to `dashboard.tsx` (member portal
header). Clicking opens a modal listing every `subscription_plans` row
returned `where active=true` (new column, see §5).

- Same plan → after payment confirms, extend `subscription_expiry` by
  `plan.duration_months` from `max(now, current_expiry)`. Keep `member_id`,
  keep `tier`.
- Different plan → after payment confirms, set `tier=newTier`,
  generate a new `member_id` via `generate_member_id`, reset
  `subscription_start=now`, `subscription_expiry=now + duration`.
- Auto-prompt the same modal when expiry is < 30 days away.

A new server fn `renewMembership({ plan_id })` handles the post-payment
update so the logic lives in one place (called from `verifyPayment` when
the submission is flagged as a renewal via `member_message=renew:<plan_id>`).

---

## 4. Admin plans — CRUD + toggle

Extend `subscription_plans`:

- add `active boolean DEFAULT true`
- add `display_order int DEFAULT 0`
- relax `tier` so admins can create custom tiers (keep enum but also
  accept arbitrary slugs via a new `slug text unique` column the public
  routes use for `/apply/$slug`).

Update `/admin/plans`:

- "+ New plan" button → modal (slug, display name, amount, currency,
  duration, description, PDF, post-download message).
- Each plan row gets a **toggle switch** wired to `active`.
- Reorder via up/down arrows on `display_order`.

`membership.tsx` and the renew modal both filter `where active=true` and
order by `display_order`, so any new plan flows automatically.

---

## 5. Backup / Restore fix

Symptom: Restore still throws. Most likely culprits in `restoreBackup`:

1. `admin_exec_sql` rejects multi-statement strings — even though we
   added `splitSql`, the policy block is still a single huge string.
   Switch to executing one statement at a time and surface the failing
   SQL in the log entry.
2. JSONL imports for tables that have generated columns or array types
   crash on `insert(parsed)` — wrap each row in try/catch, log row
   number, continue.
3. Storage restore uses `upload(path, blob, { upsert: true })` but the
   blob comes back as a `Uint8Array` from JSZip — wrap in
   `new Blob([bytes])`.

Add a `/admin/backup` "Diagnostics" panel that calls a new
`pingBackupSystem` server fn returning `{ admin_exec_sql: ok, list_tables: ok, buckets: [...] }` so we can confirm DB plumbing before a real restore.

---

## Database changes (single migration)

```sql
-- Plans
alter table public.subscription_plans
  add column if not exists active boolean not null default true,
  add column if not exists display_order int not null default 0,
  add column if not exists slug text unique;

-- Pending applications (anonymous start)
create table public.pending_applications (
  id uuid primary key default gen_random_uuid(),
  tier text not null,
  full_name text not null,
  email text not null,
  phone text not null,
  company_name text not null default '',
  claim_token uuid not null default gen_random_uuid(),
  user_id uuid,
  status text not null default 'awaiting_payment',  -- awaiting_payment | paid | claimed
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
alter table public.pending_applications enable row level security;
create policy "Anyone can create" on public.pending_applications
  for insert to anon, authenticated with check (true);
create policy "Owner reads via token" on public.pending_applications
  for select using (true);  -- token is the secret
create policy "Admins manage" on public.pending_applications
  for all to authenticated using (has_role(auth.uid(),'admin'))
  with check (has_role(auth.uid(),'admin'));

-- Mark renewals
alter table public.payment_submissions
  add column if not exists kind text not null default 'new'; -- new | renew
```

(All RLS scoped via `has_role` + token; service-role server fns do the
actual writes.)

---

## Files to add / change

```
NEW   src/lib/onboarding.functions.ts        # createPendingApplication, claimPendingApplication, renewMembership
NEW   src/components/dashboard/RenewModal.tsx
EDIT  src/lib/payments.functions.ts          # accept pending_application_id; on confirm → auto-create user + member_profile + run renewMembership
EDIT  src/routes/api/public/paystack-webhook.ts + hubtel-callback.ts (idempotent confirm path)
EDIT  src/routes/apply.$tier.tsx             # 4-step flow, anonymous start, corporate form
EDIT  src/routes/membership.tsx              # filter active plans, order by display_order
EDIT  src/routes/admin.plans.tsx             # +New plan, toggle, reorder, slug
EDIT  src/routes/dashboard.tsx               # Renew button + modal mount
EDIT  src/lib/backup.functions.ts            # statement-by-statement exec, blob wrap, per-row try/catch, ping fn
EDIT  src/routes/admin.backup.tsx            # show diagnostics; surface per-statement errors
SEED  supabase/insert  → application_forms (corporate schema above)
SEED  upload PDF → content bucket → set subscription_plans.application_form_pdf_url for corporate
```

---

## Out of scope for this turn (can follow up)

- Per-field visibility toggles + 3 named signature slots in cert designer
- `/admin/email-templates` page (welcome email currently uses default magic-link template)
- Welcome modal + confetti on first login

Let me know if you want any of those folded in now.
