
## 1. Member-submitted business directory

### Database (one migration)

Extend `directory_entries`:
- `user_id uuid references auth.users(id) on delete set null` — links entry to its owning member (nullable so admin-curated entries still work).
- `status text not null default 'draft'` — values: `draft`, `pending`, `approved`, `rejected`, `suspended`.
- `submitted_at`, `reviewed_at timestamptz`, `reviewed_by uuid`, `review_notes text`.
- Unique partial index: one entry per `user_id` where `user_id is not null`.

Replace the public visibility rule. The `directory_entries_public` view (and the corporate-members feed) become:
```
WHERE published = true AND status = 'approved'
  AND (user_id IS NULL                       -- admin-curated, no sub gate
       OR EXISTS (SELECT 1 FROM member_profiles mp
                  WHERE mp.user_id = directory_entries.user_id
                    AND mp.subscription_expiry > now()))
```
This makes expired-subscription entries disappear automatically — no cron needed.

RLS additions:
- Members can `SELECT`/`INSERT`/`UPDATE` their own row (`user_id = auth.uid()`) but cannot set `status` to anything other than `draft`/`pending` (enforce via trigger that resets non-admin status writes).
- Admins keep full access (existing `has_role(...,'admin')` policy).

Helper RPC `submit_my_directory_entry(payload jsonb)` (`SECURITY DEFINER`): upserts the member's entry, forces `status='pending'`, blocks the call when `member_profiles.subscription_expiry <= now()`.

New table `membership_resources`:
- `title`, `slug`, `category`, `description`, `body` (markdown), `file_url`, `external_url`, `cover_image_url`, `min_tier` (enum: associate/standard/corporate/null=all), `published bool`, `display_order int`.
- RLS: anyone (anon+auth) can read `published = true`; admin/staff full CRUD.

### Member dashboard — new "Business Directory" tab

`/dashboard?tab=directory-listing` rendered inside existing `DashboardLayout`:
- Loads the member's `directory_entries` row (if any) plus active `directory_custom_field_defs`.
- Shows current status badge (Draft / Pending review / Approved / Rejected with notes / Suspended — subscription expired).
- Form with all fixed fields (company, slug auto-generated, type, logo, descriptions, contacts, products/services, executives) + custom fields via `DynamicFieldRenderer`.
- "Save draft" and "Submit for review" buttons. Both disabled (with explainer card) when `subscription_expiry <= now()`.
- After approval, shows a "View public page" link to `/directory/$slug`.

Add the tab to `TAB_ITEMS` in `DashboardLayout.tsx`.

### Admin — approval queue

Extend `/admin/directory-entries`:
- Add a "Status" filter (All / Pending / Approved / Rejected / Suspended / Draft) and column.
- Row actions: **Approve**, **Reject** (prompt for notes), **Withdraw approval** (sets back to `pending`), plus the existing Edit / Feature / Delete.
- In the edit modal add a **Linked member** picker (searches `member_profiles` by name/email/member_id; clears the link with one click). Saving sets `user_id`, which is what makes the entry appear in that member's dashboard.

### Public template page

`/directory/$slug` already renders fixed + custom fields. No code change needed — the view filter above already hides non-approved or subscription-lapsed entries.

## 2. Admin "Membership Resources" — full CRUD

New route `/admin/resources` (added under the "Content" section of the admin sidebar):
- Table (title, category, min tier, published, order) with search.
- Create/Edit modal: title (auto-slug), category, cover image upload, description, markdown body, file upload to `content` bucket, external URL, min tier, published, display order.
- Delete confirmation.

Update the existing dashboard "Resources" tab to pull from `membership_resources` filtered by the member's tier instead of any hard-coded list.

## 3. User management — add Members view

`/admin/users` currently only handles admin/staff/moderator accounts. Add a second tab **"Members"**:
- Lists `member_profiles` (name, email, member_id, tier, subscription status, directory status).
- Actions: view profile, change tier, extend subscription, suspend/reactivate (already covered by existing `admin.members` route — we'll link to it from here rather than duplicate).
- The existing **Staff & Admins** tab keeps the current create/role/delete flow.

This gives one entry point that distinguishes the three constituencies (members across the 3 subscription tiers, staff, admins) without duplicating the member management UI that already lives at `/admin/members`.

## Files

**New**
- `supabase/migrations/<ts>_member_directory_listings_and_resources.sql`
- `src/routes/dashboard.directory-listing.tsx` *(or add as a tab panel inside `dashboard.tsx`)*
- `src/routes/admin.resources.tsx`
- `src/components/admin/MemberLinkPicker.tsx`

**Edited**
- `src/components/dashboard/DashboardLayout.tsx` — new tab entry.
- `src/routes/dashboard.tsx` — render the new tab panel; replace Resources tab to read from `membership_resources`.
- `src/routes/admin.directory-entries.tsx` — status column/filter, approve/reject/withdraw actions, member picker in modal.
- `src/routes/admin.tsx` — add Resources nav item.
- `src/routes/admin.users.tsx` — add Members tab linking to `/admin/members`.
- `src/routes/directory.$slug.tsx` — only if needed to show "suspended" 404 gracefully.

## Out of scope

- Email notifications on approve/reject (can be added later via existing email-templates infra).
- Multiple directory entries per member (one entry per `user_id`).
- Custom permission editor for staff beyond the existing three roles.
