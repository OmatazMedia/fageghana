## 1. Payment gateway — skip picker when only one is enabled

**Public application funnel (`/apply/$tier`)** already auto-skips when exactly one online gateway exists and no manual_bank — keep as is.

**Member dashboard → Subscription tab** currently has its own manual form that just `INSERT`s a `payment_submissions` row (no real checkout redirect). Replace it with the same logic:
- 1 enabled online gateway → single "Pay {amount} with {Gateway}" button → calls `initRenewalPayment` → redirects to provider
- multiple → grid of gateway cards
- include manual_bank as a secondary option (upload proof) when configured

## 2. Deterministic temporary password + forced reset

In `src/lib/membership.server.ts → ensureUserForEmail`, replace `randomPassword()` with:

```
tempPassword = `${firstName}@${lastPhone2}`   // e.g. "Kwame@47"
```

- `firstName` = first whitespace-separated token of `full_name`, capitalised, stripped of non-alphanumerics, fallback `Member`
- `lastPhone2` = last 2 digits of `phone`, fallback `00`
- still set `user_metadata.must_change_password: true`
- still pass `tempPassword` to the welcome notification body

**Forced password change**:
- Add `src/routes/account.change-password.tsx` — guarded route that reads `user.user_metadata.must_change_password`, shows a single "New password / Confirm" form, calls `supabase.auth.updateUser({ password, data: { must_change_password: false } })`, then redirects to `/dashboard`.
- In `src/components/auth/AuthProvider.tsx` (or `src/routes/dashboard.tsx` guard), if `must_change_password === true`, redirect to `/account/change-password` and block dashboard access until cleared.

## 3. Welcome email with login details

The project does not yet have an email domain configured. To actually send branded emails we need to set one up first — see question below. While that's pending, the existing in-app notification (already inserted in `finalizePaymentConfirmation`) will continue to carry the temp password + login link so nothing is lost.

Once the domain is set up, scaffold transactional emails and add a `sendWelcomeEmail(email, fullName, tempPassword, loginLink)` call inside `finalizePaymentConfirmation` right after the notification insert.

## 4. Subscription tab — active details, renew flow, receipt

Rewrite `SubscriptionTab` in `src/routes/dashboard.tsx`:

**When active subscription exists** — show a card with: Member ID, tier, plan name, amount, start, expiry, days remaining, and a "Renew membership" button.

**Renew modal** — opens a dialog listing every active `subscription_plans` row (current plan visually marked "Your current plan"). User picks a plan, then picks a gateway (skipped if only one online gateway), then is redirected via `initRenewalPayment({ plan_id, gateway_id })`.

Server side (already implemented in `membership.server.ts → finalizePaymentConfirmation`):
- same plan → extend `subscription_expiry` by `duration_months`, keep `member_id`
- different plan → regenerate `member_id` via `generate_member_id(_tier)`, reset `subscription_start = now`, set new expiry

**Receipt** — for each row in payment history, when `status = 'confirmed'`, add a "Download receipt" button that opens a printable HTML receipt page (`/receipt/$id`) showing FAGE logo, member name + ID, plan, amount, currency, reference, gateway, paid date, expiry — with a print stylesheet so the user can print to PDF / save.

## 5. Blog post template

`src/routes/news.$slug.tsx` already exists and renders: hero cover, category badge, title, author/date/category meta, excerpt blockquote, HTML/plain-text body, prev/next nav, related articles, and a sticky sidebar (recent posts + CTA). All `Link to="/news/$slug"` from `news.tsx` route here. **No changes needed** unless you want a styling refresh — flag if so.

## Technical notes

- `initRenewalPayment` already exists and accepts `{ plan_id, gateway_id }`; reuse it rather than building a new endpoint.
- Receipt route is read-only (member RLS on `payment_submissions` already restricts to `auth.uid() = user_id`).
- No new DB migrations required.
- `must_change_password` is read from `auth.users.user_metadata` client-side via `supabase.auth.getUser()`; no schema change.

## Out of scope

- Admin gateway CRUD (already works at `/admin/gateways`).
- Backup/restore.
- Public site redesign.

## One question before I build

Email delivery requires a verified sender domain. Do you want me to:
**(a)** set up an email domain now (you'll need access to your domain's DNS), so the welcome email + temp password can actually be sent, **or**
**(b)** ship just the in-app notification for now (already shows temp password + login link) and add email later?
