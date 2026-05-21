# Plan: Paystack + Dual Email System + Template Builder

## 1. Paystack — verify & wire to membership payments

**Current state:** `payment_gateways` row exists with `provider='paystack'` and `config.public_key/secret_key`. `paystack-webhook` server route reads `PAYSTACK_SECRET_KEY` env var. Gap: the admin-entered keys in DB are not used by `initApplicationPayment` / `initRenewalPayment`, and the webhook only checks env secret.

**Fix:**

- `src/lib/payments.functions.ts`: when initiating a Paystack charge, read `secret_key` from the selected gateway row (fallback to `process.env.PAYSTACK_SECRET_KEY`). Build a real `POST https://api.paystack.co/transaction/initialize` call with `email`, `amount` (kobo), `reference`, `callback_url=/payment/callback?ref=…&pid=…`. Persist returned `authorization_url` and redirect the user there.
- `payment.callback.tsx`: after Paystack redirects back, call a new `verifyPaystackPayment` server fn that hits `GET /transaction/verify/:reference` with the gateway's secret, marks `payment_submissions.status='confirmed'`, then runs the existing `finalizePaymentConfirmation` (creates user, member_id, sends welcome notification + email).
- `paystack-webhook.ts`: also accept the gateway row's `secret_key` (lookup by reference → gateway_id) so admin-entered keys work without a Lovable secret.
- Add a tiny "Test connection" button on `/admin/gateways` that calls Paystack `/bank` with the saved secret to confirm keys are valid.

## 2. Email system — Resend (primary) + SMTP (fallback)

**New table `email_settings**` (single-row, admin-only RLS):

- `resend_api_key text`, `resend_from text`, `resend_enabled bool`
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password`, `smtp_from`, `smtp_secure bool`, `smtp_enabled bool`
- `primary_provider text default 'resend'` (resend|smtp)

Secrets are stored in DB (admin convenience as chosen). RLS: only admins can select/update; service role reads it from server functions.

**New admin page `/admin/email-settings`:**

- Two cards (Resend / SMTP) with form fields, "Save" and "Send test email" buttons.
- "Send test" calls `sendTestEmail` server fn for that provider and shows pass/fail + error.

**New server module `src/lib/email/send.server.ts`:**

- `sendEmail({ to, subject, html, text })` reads `email_settings`, tries `primary_provider` first, on any error/timeout (8s) falls back to the other if enabled, logs every attempt to a new `email_log` table (`provider`, `status`, `error`, `to`, `subject`, `template_id`, `created_at`).
- Resend path: `fetch('https://api.resend.com/emails', Authorization: Bearer <key>)`.
- SMTP path: use `nodemailer` (works under nodejs_compat). `bun add nodemailer @types/nodemailer`.

**Wire into existing flows:**

- `finalizePaymentConfirmation` → send "Welcome + temp password" email.
- Renewal confirmation → send "Renewal receipt" email.
- Password change / reset → use existing Supabase auth (unchanged).
- Application form submitted → "Application received" email.

## 3. Block-based drag-and-drop template editor

**New tables:**

- `email_templates(id, key text unique, name, subject, blocks jsonb, updated_at)` — `key` is the system slug (e.g. `welcome`, `receipt`, `renewal`, `application_received`).
- Seed 4 rows for the triggers above (defaults rendered from site theme).

**New admin page `/admin/email-templates`:**

- Left: list of templates. Right: editor.
- Editor uses `@dnd-kit/core` (already common; install if missing) with a palette of block types: **Heading, Text, Image, Button, Divider, Spacer, Two-column**.
- Each block has an inline settings popover (text content, alignment, link URL, image upload via existing `uploadImage`).
- Live preview pane on the right rendering the same HTML the mailer will send.
- "Variables" chip list (e.g. `{{name}}`, `{{member_id}}`, `{{amount}}`, `{{temp_password}}`) inserts merge tags.
- Subject field at the top.

**Renderer `src/lib/email/render.ts`:**

- `renderBlocks(blocks, variables)` returns `{html, text}`.
- Wraps content in a responsive table layout themed with the site's tokens (primary color = FAGE green, brand font stack, logo header, footer with org address). Theme values are read from a small `email_theme.ts` constants file mirroring `src/styles.css` brand colors so emails match the website look.

**Trigger code calls:**

```ts
const tpl = await loadTemplate('welcome');
const { html, text } = renderBlocks(tpl.blocks, { name, temp_password, member_id });
await sendEmail({ to, subject: interpolate(tpl.subject, vars), html, text });
```

## Technical notes

- All admin pages gated by existing `has_role(auth.uid(),'admin')`.
- `email_settings`, `email_templates`, `email_log` use admin-only RLS; nothing exposed publicly.
- `nodemailer` is Worker-safe under nodejs_compat (uses `net`/`tls` which are supported).
- Resend keys stored encrypted-at-rest by Supabase; never sent to client (admin page fetches via server fn that masks the key after save).
- No changes to Lovable Cloud built-in email; this is a parallel, fully self-managed system per your spec.

## Out of scope (ask later if needed)

- Welcome email language/copy beyond a sensible default (you can edit in the builder).
- Marketing/bulk sends — this stays transactional.

## Open questions before build

1. **Templates to seed**: I'll start with Welcome + Temp Password, Payment Receipt, Renewal Receipt, Application Received. Add/remove any?
2. **SMTP "secure" default**: assume TLS on port 465, STARTTLS on 587 — OK?  
  
answer to questions:  
1. yea  
2. yea  
  
  
alsways let me those that has been done and what is remaining