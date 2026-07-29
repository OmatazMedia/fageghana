## 1. Redesign Admin Support page with tabs

Chat widget "Leave a message" writes to `contact_messages` with `source='chat_widget'`, but the notification bell links to `/admin/tickets` which only shows `support_tickets` — so the message appears missing.

Rebuild `src/routes/admin.tickets.tsx` as a tabbed page:

- **Tab 1 – Support Tickets** (default): all tickets from members with sub-filters *Open · Pending · Resolved · Closed · All*, search by subject/member, priority badges, reply drawer (existing ticket flow preserved).
- **Tab 2 – Chatbot Messages**: lists `contact_messages` where `source='chat_widget'`, showing name / phone / email / message / created_at, with a "Convert to ticket" action and "Mark handled" (adds a `handled_at` column via migration).
- Deep-link support: `/admin/tickets?tab=chat` opens directly on the Chatbot Messages tab.
- Update `src/lib/notifications.ts` so `contact_messages` feed items link to `/admin/tickets?tab=chat` and scroll to the row (`#msg-<id>`). Tab 1 tickets keep `/admin/tickets?tab=tickets&id=<id>`.

## 2. Email notifications for chatbot "Leave a message"

- Add `admin_notification_settings` (singleton) with `chat_message_recipients text[]` — admin-editable list of emails.
- New admin page **Admin → Settings → Notifications** to edit the recipient list.
- Create branded React Email template `chat-message.tsx` (logo header, name/phone/email/message body, "Reply" CTA to `/admin/tickets?tab=chat`, footer) — mobile-responsive using the existing email theme.
- After the chat widget inserts a `contact_messages` row, POST to a new server function that renders the template and sends via the existing email sender to every recipient. Silent failure so the user flow isn't blocked.

## 3. Member subscription lifecycle

**Current behaviour (verified from `RenewalLockScreen.tsx` + `dashboard.tsx`):** once `subscription_expiry < now()`, members can still sign in but the dashboard is fully replaced by a lock screen offering renewal (bank details + proof upload). Support page is not accessible from that screen today.

**Changes:**

- Add a "Contact support" link on `RenewalLockScreen` that opens the existing support ticket form (allowed while locked).
- Add a **3-month renewal countdown banner** for active members:
  - Shown when `subscription_expiry - now() ≤ 90 days`.
  - Sits directly above the dashboard top bar, red background, live countdown ("Your membership expires in 42 days — Renew now").
  - Dismissible via "×" per-session only (stored in `sessionStorage`, so every fresh login re-shows it until renewal).
  - Renew button opens the same renewal flow used on the lock screen.
- Write up "What happens on expiry" as an in-app help note under Account → Membership so members know: they can still log in, dashboard is locked to renewal + support until they renew, no data is deleted.

## 4. Fix directory submission enum error

`submit_my_directory_entry` currently does:

```
COALESCE(_payload->>'entry_type', entry_type)  -- text vs directory_entry_type
```

Postgres refuses to mix `text` and the enum. Migration will replace the two offending lines to cast explicitly:

```
COALESCE((_payload->>'entry_type')::directory_entry_type, 'corporate'::directory_entry_type)  -- INSERT
COALESCE((_payload->>'entry_type')::directory_entry_type, entry_type)                          -- UPDATE
```

No other function/behaviour changes.

## Technical details

**Migrations**

- `ALTER TABLE contact_messages ADD COLUMN handled_at timestamptz;`
- `CREATE TABLE admin_notification_settings (id int PK default 1, chat_message_recipients text[] default '{}', updated_at timestamptz)` + GRANTs + admin-only RLS.
- Rewrite `submit_my_directory_entry` with the two casts above.

**Files touched**

- `src/routes/admin.tickets.tsx` — tabbed rewrite.
- `src/lib/notifications.ts` — `contact_messages` href.
- `src/components/dashboard/DashboardLayout.tsx` — renewal countdown banner.
- `src/components/dashboard/RenewalLockScreen.tsx` — support link.
- `src/lib/email-templates/chat-message.tsx` (new).
- `src/lib/email/chat-notify.functions.ts` (new) — recipient lookup + send.
- `src/components/site/ChatWidget.tsx` — call the notify server fn after insert.
- `src/routes/admin.notifications-settings.tsx` (new) — recipient list editor.

No changes to auth, RLS beyond the new settings table, or any other admin surface.  
  
any one you didnt fnish should be written out so i can continue later

&nbsp;