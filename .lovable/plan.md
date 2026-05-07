
## 1. Auth pages redesign (`/admin/login`, `/login`)

Two-column split layout (image + brand copy on left, form on right). Reuse the same shell component with different copy.
- **Member login** left panel: hero image + "Why join FAGE" benefits list (Certificate of membership, Networking & trade leads, Trainings & events, Export advisory, Recognition & advocacy, Discounts on FAGE programs).
- **Admin login** left panel: hero image + "FAGE Admin Console" copy ("Manage members, payments, certificates, content").
- All password inputs become **always-visible plain text** (`type="text"` styled like a password) per request — applies to `/login`, `/admin/login`, `/reset-password`, and any future password fields.
- Add hero images to `src/assets/` (generated, agriculture/Ghana export themed).

## 2. Admin-managed member accounts

New page `/admin/members` (list of `member_profiles` joined with auth) and **"Create member" modal** with:
- Email, full name, phone, company, **membership tier** (required), subscription start/expiry (auto from plan duration).
- Toggle: **"Set password now (immediate login)"** vs **"Send set-password email link"**.
  - Path A: server function uses admin client to `auth.admin.createUser({ email, password, email_confirm: true })`.
  - Path B: `auth.admin.inviteUserByEmail(email)` (or `generateLink({ type: 'invite' })`) — member receives email, sets password, lands on `/dashboard`.
- After creation: insert `member_profiles` row, auto-generate `member_id` via existing `generate_member_id`, mark subscription active, auto-issue certificate (reuses payment-confirmed flow).

## 3. Application approval → certificate flow

Currently certs auto-issue on payment confirmation. Extend so **any approved application** (admin clicks "Approve" on `/admin/applications`) also:
- Creates/links member account (if not existing — sends invite link by default).
- Generates member_id for selected tier.
- Issues certificate.
- Sends notification.

## 4. Form builder (drag-and-drop) per membership tier

New table `application_forms` (one per tier) with `schema jsonb` storing field array. New table `application_submissions` storing `answers jsonb`, `tier`, `payment_id`, `user_id`, `status`.

**Builder UI** at `/admin/forms` — uses **`@dnd-kit/core` + `@dnd-kit/sortable`** (already idiomatic for React DnD).
- Left palette: Text, Paragraph (textarea), Number, Email, Phone, Date, Dropdown, Radio group, Checkbox group, Single checkbox, File upload, Section heading.
- Center canvas: drag fields in, reorder, click to edit (label, name, required, placeholder, options, help text).
- Right inspector panel for selected field props.
- Save serializes to `schema` jsonb. Per-tier publish toggle.

**Renderer** component `<DynamicForm schema={...} onSubmit={...} />` used by the application page.

## 5. Paid application flow (cannot bypass payment)

Public membership page `/membership` already lists tiers with "Apply as Associate / Standard / Corporate" buttons. New flow:

```text
Membership page
  ├─ "Apply as X"  ──► /apply/$tier  (payment selection page)
  └─ "Download form (PDF)"  ──► direct PDF download + toast with admin-set instructions
```

`/apply/$tier`:
1. Show plan amount (from `subscription_plans`, admin-editable).
2. Show enabled gateways. If member picks **online gateway** → (placeholder Paystack init, manual stub for now) → on success creates `payment_submissions` row `confirmed` → unlock form.
3. If member picks **manual bank deposit** → show bank details + downloadable form + toast/instructions: *"Download the registration form, complete it, attach proof of payment, and email both to <admin email>. Your account will be created once payment is verified."* → no form unlock; admin handles in step 2/3.
4. Form route `/apply/$tier/form/$paymentId` is **gated** by server function checking `payment_submissions.status = 'confirmed' AND user_id = auth.uid()`. Direct URL access without confirmed payment → redirect to `/apply/$tier`.

Auth requirement: must be signed in to apply. If not, prompt sign-in/sign-up first (account auto-created so payment links to user).

## 6. Per-tier downloadable PDF + post-download instructions

Extend `subscription_plans` (or new `membership_tier_settings` table keyed by tier) with:
- `application_form_pdf_url text`
- `post_download_message text` (default seed: *"Thanks for downloading the FAGE membership form. Complete all sections, attach your proof of payment, and email everything to membership@fageghana.org. Our team will verify and activate your account within 2 business days."*)
- `bank_deposit_email text` (where members send proof)

Admin edits these on `/admin/plans` (new page) — also sets **amount, currency, duration_months** per tier.

Membership page shows "Download form (PDF)" button next to each tier card → triggers download + sonner toast with `post_download_message`.

## 7. Manual bank deposit — multiple banks

Currently `payment_gateways` of provider `manual_bank` has single `bank_details` jsonb. Change semantics: allow **multiple `manual_bank` rows** (already supported — each row is its own gateway entry). On `/admin/gateways`, clarify with helper text "Add one entry per bank account." On member payment page, list every enabled manual_bank row as a separate option.

## 8. Member dashboard — subscription status & renewal countdown

On `/dashboard` Overview: prominent card showing
- Status badge (Active / Expiring soon / Expired) based on `subscription_expiry`.
- **Countdown** ("Expires in 23 days") when within 60 days; red banner when within 14 days or expired.
- **"Renew membership"** button → `/renew` → tier picker (defaults to current tier) + gateway picker (reuses `/apply` payment component). On confirmed payment:
  - Extend `subscription_expiry` by plan duration.
  - Re-issue certificate (new `verification_code`, new `expires_at`). Member ID is **kept** (per request: "id changes" — confirm? Currently member_id is permanent; re-issuing on renewal means new cert only, same ID. **Implementation: keep member_id permanent, regenerate cert.** If user truly wants new ID per renewal we'll flip a flag.)
- No form re-fill on renewal.

Notifications panel surfaces "Your membership expires in N days" reminders (admin can also broadcast).

## 9. Membership page front-end additions

For each tier card on `/membership`:
- "Apply as {tier}" → `/apply/{tier}` (payment-first)
- "Download form (PDF)" → triggers PDF download + toast with admin-configured message

## Technical details

**New/changed DB:**
- `application_forms (id, tier unique, schema jsonb, published bool, updated_at)`
- `application_submissions (id, user_id, tier, payment_id, answers jsonb, status, created_at)`
- `subscription_plans` add columns: `application_form_pdf_url`, `post_download_message`, `bank_deposit_email`
- Seed default `post_download_message` for each tier.

**RLS:** application_forms public-read where published; admin manage. application_submissions: members own row, admins all.

**New routes:**
- `src/routes/admin.members.tsx` — member directory + create modal
- `src/routes/admin.forms.tsx` — DnD form builder
- `src/routes/admin.plans.tsx` — tier amount, PDF, instructions, bank email
- `src/routes/apply.$tier.tsx` — payment gate
- `src/routes/apply.$tier.form.$paymentId.tsx` — gated dynamic form
- `src/routes/renew.tsx` — renewal flow
- `src/routes/reset-password.tsx` — for invite-link path

**New libs:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

**Server functions:**
- `createMemberAccount` (admin client: createUser or inviteUserByEmail) — `requireSupabaseAuth` + admin role check, then admin client.
- `unlockApplicationForm` — verifies payment confirmed, returns form schema.
- `processRenewal` — extends expiry, re-issues cert.

**Auth pages:** new shared `<AuthSplit>` component (image left, content right). All password inputs use `type="text"` (unmaskable) per explicit user request — flagged as a UX/security tradeoff but honoring the instruction.

**Admin nav additions:** Members, Plans & Forms (PDF/instructions), Form Builder.

## Out of scope (this iteration)

- Real Paystack/Hubtel SDK integration (still stubbed; manual bank flow is fully functional).
- Email template branding (uses default Supabase invite email; can be scaffolded later).
- Per-renewal new member ID (keeping IDs permanent — confirm if you want changed).
