
## Scope

Four additions to the public site:

1. **Contact page** (`/contact`) — sourced from fageghana.com/contact
2. **Single-blog upgrades** — share, reactions, sidebar (prev/next already exists)
3. **Site-wide search overlay** — triggered from the navbar search icon
4. **Chat widget + Back-to-top button** — bot simulation, WhatsApp handoff, offline message form

---

## 1. Contact page — `src/routes/contact.tsx`

New route, premium layout, real info from fageghana.com/contact:

- **Hero** — "Contact Us" with eyebrow "Get In Touch"
- **Two-column section**
  - Left: contact form (Name, Email, Subject, Message) → saves to a new `contact_messages` table and shows a success toast
  - Right: info cards
    - **Phone**: +233 (0) 53 517 0780 | +233 (0) 53 522 4555
    - **Email**: info@fageghana.com
    - **Location**: Number 22, Nii Tsatse Dzani Street, Adjiringanor, Accra (kept from footer — current accurate address; the old fageghana.com address is outdated)
- **Embedded Google Map** (iframe) for the Accra office
- **Social row** reusing footer socials
- Add **Contact** link to `SiteHeader` nav and mobile menu

DB: new `contact_messages` table (name, email, subject, message, created_at) with RLS — anyone can insert, admins can read.

`head()` SEO with title/description/og.

---

## 2. Single blog enhancements — `src/routes/news.$slug.tsx`

Already has prev/next, related posts, recent posts sidebar. Add:

- **Share bar** at end of article — Facebook, X/Twitter, LinkedIn, WhatsApp, Copy link buttons (use `window.location.href` + share intents)
- **Reactions bar** — 5 emoji reactions (👍 ❤️ 🎉 😮 👏) with counts. Stored in new `blog_reactions` table (`news_id`, `emoji`, `session_id`, `created_at`). One reaction per browser per post (localStorage `session_id`). Public insert/select RLS.
- **Sidebar already exists** with recent posts + CTA — keep as-is.

---

## 3. Site-wide search overlay

New component `src/components/site/SearchOverlay.tsx`:

- Triggered by Search icon in `SiteHeader` (and a mobile entry)
- Full-screen dark overlay (`bg-background/95 backdrop-blur`), large input at top, ESC + click-outside to close
- Debounced query (250 ms) runs parallel Supabase queries across:
  - `news` (title, excerpt) → link `/news/$slug`
  - `products` (name, description) → link `/products`
  - `activities` (title, description) → link `/activities`
  - `media` (title) → link `/media`
  - Static routes registry (About, Services, Membership, Contact, Verify) — client-side title match
- Grouped results with category headers; "No results found for '<query>'" empty state
- Hooked into the existing navbar Search button

---

## 4. Chat widget + Back-to-top — `src/components/site/ChatWidget.tsx` + `BackToTop.tsx`

Fixed bottom-right. Stack: Chat bubble (bottom), Back-to-top above it. When scroll > 400 px, Back-to-top fades in and chat bubble slides up to make room; when it disappears, chat returns to the original position.

**Onboarding**: 10 s after page load, play a soft "ding" (a small mp3/data-URI in `/public/sounds/`) and show a tooltip near the bubble: "Hi! We're here to help 👋" — auto-dismiss after 5 s.

**Bot persona**: "Ama" — clearly introduces itself as a bot, greets with Ghana-time-aware greeting (`Intl.DateTimeFormat('en-GH', { timeZone: 'Africa/Accra' })`).

**Online vs offline**: Office hours = Mon–Fri 08:00–17:00 Accra time. Outside that → "We're currently offline" banner, but quick replies still work.

**Quick-reply menu** (chips, bot-driven; selecting one shows reply with optional link):
- About FAGE → `/about/who-we-are`
- Services → `/services`
- Products → `/products`
- Membership registration → message explains both options:
  - **Online**: link to `/membership`
  - **Manual**: download form + email proof of payment to `membership@fageghana.org`
- Activities/Events → `/activities`
- News → `/news`
- Contact details → shows phone/email/address inline
- Verify a member → `/verify`
- Talk to a real person → WhatsApp handoff (see below)
- Leave a message → offline form (see below)

After any reply, wait ~4 s then prompt: "Anything else? Pick an option or type 'menu'." Typing `menu` or clicking **Back to menu** returns to quick replies.

**WhatsApp handoff**:
1. User clicks "Chat with a real person"
2. Bot asks: "Please type your request — I'll forward it to our team."
3. After they reply, bot shows "Transferring you now…" for ~5 s
4. Build a transcript: `[FAGE Chat Transcript]\nAma (bot): ...\nYou: ...\n\nMy request: <last message>`
5. Open `https://wa.me/233535170780?text=<encoded transcript>` in a new tab

**Offline "Leave a message" flow**:
1. Ask Name → Phone → Email (validated with regex) → Message
2. Save to `contact_messages` table (same one used by Contact page, with `source = 'chat'`)
3. Show "Sending…" spinner for ~5 s mock, then "Your message has been sent — we'll reach out within working days."

State stored in component state + localStorage so the conversation persists across pages.

---

## Technical notes

- All new client UI in `src/components/site/` and `src/routes/contact.tsx`
- New tables migration: `contact_messages` (public insert, admin select) and `blog_reactions` (public insert/select, dedup by `(news_id, session_id, emoji)` unique).
- WhatsApp number from `SiteHeader`/footer: **+233 53 517 0780** → `233535170780`
- Bot greetings localized via `Intl` with Africa/Accra timezone; greeting buckets: 05–11 Good morning, 12–16 Good afternoon, 17–21 Good evening, else Hello
- Notification sound: tiny synthesized "ding" via WebAudio (no asset needed), respects `prefers-reduced-motion` and a one-time `localStorage` flag so it only plays once per session
- No new packages required — use existing `lucide-react`, Supabase client, Tailwind
- All new routes get `head()` SEO metadata
- `ChatWidget` and `BackToTop` mount in `SiteLayout` so they appear on every public page

---

## File changes

**New**
- `src/routes/contact.tsx`
- `src/components/site/SearchOverlay.tsx`
- `src/components/site/ChatWidget.tsx`
- `src/components/site/BackToTop.tsx`
- `supabase/migrations/<ts>_contact_and_reactions.sql`

**Edited**
- `src/components/site/SiteHeader.tsx` — add Contact link, wire Search button to overlay
- `src/components/site/SiteFooter.tsx` — add Contact link in Explore
- `src/components/site/SiteLayout.tsx` — mount `<ChatWidget />` + `<BackToTop />` + `<SearchOverlay />` provider
- `src/routes/news.$slug.tsx` — add Share + Reactions bars

After approval I'll confirm the WhatsApp handoff number and the manual-registration email before wiring.
