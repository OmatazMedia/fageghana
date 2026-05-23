## Goal

1. Keep renewals entirely inside the member dashboard (no redirect to `/apply/{tier}`).
2. Open a modal that lists all plans, marks the member's **current** plan, lets them pick the same plan (extends expiry, same member ID) or a different one (new member ID for that tier — already handled server-side).
3. Add **Flutterwave** as a first-class gateway alongside Paystack/Hubtel/Manual Bank, configurable from Admin → Gateways. The gateway the user picks at checkout is what processes the payment.
4. Make sure receipts are downloadable from the dashboard (already wired — verify and surface clearly).

The renewal flow logic on the server already handles "same tier → extend expiry, keep member_id" vs "different tier → mint new member_id" in `finalizePaymentConfirmation`, so this work is mostly wiring and adding the Flutterwave provider.

---

## Changes

### 1. Dashboard renewal banner — open modal instead of redirecting

File: `src/routes/dashboard.tsx`

- Replace the `<a href="/apply/{tier}">Renew membership</a>` banner CTA with a button that calls `setRenewOpen(true)`, so the existing plan-picker + gateway-picker modal flow handles everything in-dashboard.
- The plan modal already badges the current plan ("Your current plan") — keep that.
- Payment history already renders a "Receipt" link to `/receipt/$id` for each `payment_submissions` row. Add a small "Download" hint and ensure confirmed rows show it. (No business-logic change.)

### 2. Add Flutterwave to the payment server functions

File: `src/lib/payments.functions.ts`

- Add `initializeFlutterwave({ gateway, email, name, phone, amount, currency, reference, callbackUrl, metadata, submissionId })` that POSTs to `https://api.flutterwave.com/v3/payments` with the gateway's `secret_key` and returns either:
  - `{ mode: "flutterwave_inline", public_key, tx_ref, amount, currency, email, name, phone, callback_url }` for inline modal, or
  - `{ redirect_url }` using the `data.link` from the API as a fallback.
- In both `initApplicationPayment` and `initRenewalPayment`, add an `else if (gateway.provider === "flutterwave")` branch that calls `initializeFlutterwave`.
- Extend `verifyPayment` with a `flutterwave` branch: call `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=<ref>` with the gateway's secret key and confirm `status === "successful"` and amount ≥ plan amount.
- Extend `testPaymentGateway` to support Flutterwave by hitting `https://api.flutterwave.com/v3/banks/NG` (or `/GH`) with the secret key for a cheap auth probe.

### 3. Flutterwave inline modal loader

New file: `src/lib/flutterwaveInline.ts`

- Mirror `paystackInline.ts`: load `https://checkout.flutterwave.com/v3.js`, call `window.FlutterwaveCheckout({...})` with `public_key`, `tx_ref`, `amount`, `currency`, `customer`, `callback`, `onclose`. On `callback`, redirect to `/payment/callback?reference=<tx_ref>&provider=flutterwave` so the existing callback page can verify.
- Update `src/routes/dashboard.tsx` and `src/routes/apply.$tier.tsx` so that when `payment.mode === "flutterwave_inline"` they call `openFlutterwaveInline(payment)`.

### 4. Flutterwave webhook route

New file: `src/routes/api/public/flutterwave-webhook.ts`

- POST handler. Verify `verif-hash` header equals the gateway's stored `webhook_secret` (added below). On `event === "charge.completed"` and `data.status === "successful"`, look up `payment_submissions` by `tx_ref` (stored as `reference`), mark `status: "confirmed"`, and call `finalizePaymentConfirmation(sub.id)`.

### 5. Admin → Gateways: Flutterwave config

File: `src/routes/admin.gateways.tsx`

- The provider dropdown already lists Flutterwave. Add a Flutterwave-only optional field `webhook_secret` that is stored in `config.webhook_secret` (used by the webhook above). No schema change needed (`payment_gateways.config` is jsonb).
- Surface the Flutterwave webhook URL (`/api/public/flutterwave-webhook`) and callback URL (`/payment/callback`) under the row, like Paystack already does.
- Allow "Test connection" for Flutterwave the same way Paystack works.

### 6. Payment callback page

File: `src/routes/payment.callback.tsx`

- Already calls `verifyPayment` with a reference. Confirm it accepts a `?reference=...&provider=flutterwave` query (it should, since verify dispatches by `payment_submissions.method`). No business logic change — just verify.

### 7. No DB migration required

- `payment_gateways.config` is `jsonb` and already holds `public_key`/`secret_key`; adding `webhook_secret` is just another key in the same blob.
- `payment_submissions.method` is text and will accept `"flutterwave"`.
- `payment_submissions.reference` already holds the unique tx ref used as Flutterwave's `tx_ref`.

---

## Technical notes

- Flutterwave amounts are sent as decimal (e.g. `120.00`), unlike Paystack's kobo/pesewa. Send `Number(plan.amount)` directly, not multiplied by 100.
- Flutterwave currency must match the gateway's account country (GHS for Ghana accounts, NGN for Nigerian). The same friendly error wrapper used for Paystack ("change plan currency or contact support") should apply.
- Inline modal flow: Flutterwave's `callback` fires before redirect, so we close the modal then `window.location.href = /payment/callback?reference=<tx_ref>&provider=flutterwave` to let the existing verify+redirect logic kick in.
- Webhook signature: Flutterwave sends `verif-hash` as a plain string equal to the secret configured in their dashboard — direct string compare against `config.webhook_secret`.
- No secret env vars need to be added; Flutterwave keys live in the `payment_gateways` row (same pattern as Paystack).

---

## After implementation, the user must

1. In Admin → Gateways, add a Flutterwave row with their public key, secret key, and (optional) webhook secret, then enable it.
2. In the Flutterwave dashboard, set the webhook URL to `https://<your-domain>/api/public/flutterwave-webhook` and paste the same webhook secret.
3. Test the connection from Admin → Gateways. Then renew from the dashboard to confirm end-to-end.  
  
add call back and webhook url where necssary to avoid network error during transaction