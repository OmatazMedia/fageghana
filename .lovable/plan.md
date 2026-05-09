## Fixes

### 1. Membership page shows only 2 hardcoded tiers
`src/routes/membership.tsx` has a hardcoded `tiers` array with only `associate` and `corporate`. Any third plan (e.g. `standard`) created in admin never appears.

**Fix:** Drive the cards from `subscription_plans` rows (joined with a small per-tier copy map for benefits/eyebrow). Show every plan that exists in the DB, in `amount` order. Also pull `application_form_pdf_url`, `description`, `currency`, `amount`, `duration_months` from each row (already loaded). Members with no admin-defined benefits get a sensible default list.

### 2. Downloaded PDF opens inline / appears blocked
Today: `window.open(application_form_pdf_url, "_blank")` — browsers render PDFs inline and popup blockers can stop it.

**Fix:** Force download by:
- Fetching the file as a Blob, then triggering an `<a download="FAGE-<tier>-application.pdf">` click via an object URL (works cross-origin since the `content` bucket is public).
- Fallback: if fetch fails, use a plain `<a href download>` click rather than `window.open`.
- Apply the same helper in both `membership.tsx` and `apply.$tier.tsx`.

### 3. "Payment details are not seen"
Two related issues on `/apply/$tier`:
- If no `payment_gateways` rows are enabled, the page only says *"No payment methods configured yet"* with no further info — members can't see plan price/bank info.
- The bank account details only render under the manual_bank step.

**Fix:**
- Always show the plan summary (price, duration, description, bank deposit email) at the top of `/apply/$tier`, regardless of gateway state.
- When at least one `manual_bank` gateway exists, surface a compact "Bank accounts" preview card on the **choose** step too (bank, account name, account number) so members see where to pay before clicking through.
- When no gateways are configured but a `bank_deposit_email` exists on the plan, show the manual instructions + email so members can still proceed.

### 4. Copy a certificate template to another tier
Today `admin/certificates` requires rebuilding the layout per tier from scratch.

**Fix:** Add a "Duplicate to…" dropdown in the designer header. Selecting a target tier:
- Copies `image_url`, `signature_url`, `authorized_name`, `field_positions`, `name` from the current tier.
- Upserts into `certificate_templates` for the target tier (insert if missing, update if it exists, after a confirm dialog).
- Toasts success and (optionally) switches the editor to the target tier so the user can fine-tune.

No DB migration needed — uses the existing `certificate_templates` columns.

## Files to change
- `src/routes/membership.tsx` — dynamic plans + force-download helper
- `src/routes/apply.$tier.tsx` — always-visible plan/bank details + force-download
- `src/lib/forceDownload.ts` *(new)* — shared `downloadFile(url, filename)` helper
- `src/routes/admin.certificates.tsx` — "Duplicate to tier" action

## Remaining phases (status snapshot)

| Phase | Status |
|---|---|
| Auth (member + admin), roles, password reset | Done |
| Membership plans CRUD + downloadable PDF | Done (this fix completes it) |
| Drag-and-drop form builder + dynamic public form | Done |
| Pre-form payment flow (Paystack + Hubtel + manual bank) | Done |
| Admin payments dashboard (list/confirm/reject) | Done |
| Admin members CRUD + admin-created accounts | Done |
| Certificate designer + issue + verify | Done; **template duplication added now** |
| News / Activities / Media / Products / Notifications / Tickets | Done |
| **Remaining work** | |
| Email notifications (payment confirmed, account created, certificate issued) — currently in-app only | Pending |
| PDF certificate download (server-rendered) for issued certs | Pending |
| Bulk member CSV import | Pending |
| Public member directory (corporate) | Pending |
| Reports/analytics export polish | Partial |
| End-to-end test of live Paystack/Hubtel webhooks against the real domain | Pending |

Tell me which of the "Remaining work" items you want next after these fixes land.