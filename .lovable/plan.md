## Plan

### 1. Directory: members-only, remove public page

- Delete `src/routes/directory.tsx` and `src/routes/directory.$slug.tsx` (public routes).
- Add `src/routes/_authenticated/directory.tsx` and `src/routes/_authenticated/directory.$slug.tsx` — same list + detail UX that exists today, but rendered inside the dashboard shell (`DashboardLayout`) so it lives as a dashboard section.
- Add a "Directory" item to the dashboard sidebar.
- Update `SiteHeader` (and footer) to drop the public Directory link; replace with "Member directory" that points to `/dashboard/directory` (or whatever route under `_authenticated`).
- Any old/external link to `/directory` or `/directory/:slug` → add a small public stub route that redirects to `/auth?redirect=/dashboard/directory/<slug>`. After login, `auth.tsx` honors the `redirect` query.
- Detail page keeps current "show all content" rendering (the prior fix already filters `is_active + approved`), just relocated.
- When any directory is clicked the full detail is displayed.

### 2. Subscription lockout → full payment modal flow

Replace today's `SubscriptionLockedScreen` with a richer lock screen that doubles as a renewal checkout:

- Top: status banner (expired / suspended / inactive) + expiry date + current tier.
- Plan picker: list `subscription_plans` (cards with price/duration/benefits). Member selects one.
- Payment method tabs:
  - **Online** (Paystack inline) — uses existing `payments.functions.ts` flow.
  - **Manual bank transfer** — shows bank account details from `payment_gateways` rows where `provider = 'bank_transfer'` (already stored in `bank_details` JSON). Includes a generated payment reference (e.g. `FAGE-RENEW-<memberId>-<timestamp>`).
- "I have made payment" button → expands an accordion with:
  - Reference (auto-filled, editable).
  - File picker (drag-drop or click) → uploads to `payment-proofs` bucket.
  - Amount + plan (preselected).
  - Submit → inserts `payment_submissions` row (status `pending`, plan_id, reference, proof_url, user_id).
- After submission: locked screen shows "Awaiting admin confirmation" state with the uploaded proof + reference.

Admin side (`admin.payments.tsx` — extend existing page):

- Pending manual submissions list with proof preview.
- "Confirm & activate" action — server fn `confirmManualPayment` that:
  - Marks `payment_submissions` row `approved`.
  - Extends `member_profiles.subscription_expiry` by plan duration, sets `tier`, sets `status='approved'`.
  - Calls `generate_member_id(tier)` if member has no `member_id`.
  - Inserts a receipt row (reuse existing receipt path; `receipt.$id.tsx` already renders).
- "Reject" action with note.

Member then sees normal dashboard + receipt link.

### 3. Dashboard "Media manager" — Hero slides & Partner logos

New DB tables (migration):

- `site_hero_slides` (`id`, `image_url`, `headline`, `subheadline`, `cta_label`, `cta_href`, `display_order`, `is_active`, timestamps).
- `site_partner_logos` (`id`, `name`, `logo_url`, `link_url`, `display_order`, `is_active`, timestamps).

Grants + RLS:

- `GRANT SELECT TO anon, authenticated` (homepage reads).
- `GRANT ALL TO service_role`.
- `INSERT/UPDATE/DELETE` policies restricted to admins via `has_role(auth.uid(),'admin')`.

Admin UI under dashboard (admin-only tabs in `admin.media.tsx` or new `admin.site-content.tsx`):

- **Hero slides** tab: list with thumbnail, drag-to-reorder (updates `display_order`), edit dialog (upload image to `content` bucket via existing `uploadImage`, headline, subheadline, CTA text + link, active toggle), add/delete.
- **Partner logos** tab: grid of logos, upload, optional link, reorder, delete. Logos render at a uniform CSS box (e.g. `h-12 w-auto object-contain`) so all sizes normalize automatically.

Frontend:

- `src/routes/index.tsx` hero section reads `site_hero_slides` (ordered, active) and renders the existing carousel/slider using DB rows instead of hardcoded data.
- "Our Partners" section reads `site_partner_logos` with uniform sizing.
- Both via TanStack Query against public `anon` SELECT.

### 4. Technical details

- New server functions in `src/lib/site-content.functions.ts` (list/upsert/delete hero slides + logos; admin-guarded with `requireSupabaseAuth` + `has_role` check).
- New `src/lib/payments.functions.ts` additions: `submitManualRenewal`, `adminConfirmManualPayment`, `adminRejectManualPayment`.
- New component `src/components/dashboard/RenewalLockScreen.tsx` replaces `SubscriptionLockedScreen` usage in `dashboard.tsx`.
- New components `src/components/admin/HeroSlidesManager.tsx`, `PartnerLogosManager.tsx`.
- `auth.tsx` / login already supports `?redirect=` — verify; otherwise add.
- Remove public directory nav links in `SiteHeader.tsx` and `SiteFooter.tsx`.

### 5. Out of scope (confirm if you want them in)

- Auto-emailing the member when admin approves their manual payment.
- Public "teaser" directory (showing names only to non-members).
- Editing arbitrary homepage sections beyond hero + partners (services, stats, testimonials).