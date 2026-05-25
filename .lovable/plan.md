## Remaining work — member-side dashboard UI

Admin tools and DB are done. This plan covers the member-facing pieces in `src/routes/dashboard.tsx`.

### 1. Events tab (new)
- Sidebar entry "Events".
- List upcoming `activities` (event_date >= now, published) as cards: title, date, location, RSVP/Cancel button.
- "My RSVPs" section above the list — query `event_rsvps` joined to `activities` for current user.
- RSVP = insert into `event_rsvps`; Cancel = delete by `(user_id, activity_id)`.
- Toast on success/error; optimistic refresh.

### 2. Trade Opportunities tab (new)
- Sidebar entry "Trade Opportunities".
- Filters: search, category, country.
- List active `trade_opportunities` as cards with deadline badge and "I'm Interested" button.
- Interest dialog: optional `message` textarea → insert into `trade_opportunity_interests`.
- "My Interests" subsection showing previously expressed interests with withdraw action.

### 3. Member Directory tab (new)
- Sidebar entry "Directory".
- Query `member_profiles` where `status='approved' AND directory_visible=true` (RLS already allows authenticated read of those rows).
- Grid of cards: logo, company_name, contact_name, industry, country, website link, bio.
- Search by company/industry; filter by country.

### 4. Profile tab — directory preferences (enhance)
- New "Public Directory" section in existing Profile tab with:
  - `directory_visible` toggle ("Show my company in the member directory").
  - `directory_bio` textarea (max 400 chars).
  - `directory_website` url input.
  - `directory_logo_url` upload (reuse `content` bucket + `uploadImage` helper).
- Save → update own `member_profiles` row.

### 5. Readiness Score tab (rewrite)
- Replace the current static checklist with dynamic items from `readiness_checklist_items` (active=true), grouped by `category`.
- Each item: status selector (Not started / In progress / Complete), optional notes, optional evidence document picker from `member_documents`.
- Save upserts into `member_readiness_responses` keyed on `(user_id, item_id)` — needs unique constraint added (migration).
- Display overall score via `get_readiness_score(auth.uid())` RPC; show progress bar + per-category breakdown.

### Technical details
- All queries via browser `supabase` client; RLS already in place.
- New migration: `unique(user_id, item_id)` on `member_readiness_responses`; `unique(user_id, activity_id)` on `event_rsvps` (confirm existence first via read_query).
- No new packages, no new routes — all changes live inside `src/routes/dashboard.tsx` (plus small sub-components if file grows past ~800 lines, extracted into `src/components/dashboard/`).
- Sidebar nav array in `dashboard.tsx` gets 3 new entries (Events, Trade Opportunities, Directory).

### Files touched
- `src/routes/dashboard.tsx` (main edits)
- `supabase/migrations/<ts>_dashboard_member_ui.sql` (unique constraints only)
- Possibly: `src/components/dashboard/EventsTab.tsx`, `TradeTab.tsx`, `DirectoryTab.tsx`, `ReadinessTab.tsx` for code organization
