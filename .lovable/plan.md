## Problems

1. **Directory detail pages 404 for many entries.** `src/routes/directory.tsx` merges two sources into the public list: curated `directory_entries` rows AND approved `member_profiles` rows. The member-profile rows are synthesized with fake slugs like `member-{id}` that don't exist in `directory_entries`, so clicking them on `directory.$slug.tsx` returns Not Found.

2. **No bulk actions on admin directory entries.** Approve / suspend / link-to-member must currently be done one entry at a time.

3. **No way for admin to assign an existing directory entry to a member account.** When linked, the member should automatically see and edit it from their dashboard.

## Plan

### 1. Fix directory listing → detail flow

Stop synthesizing fake entries from `member_profiles`. The member-submitted directory flow already writes real rows into `directory_entries` (via `submit_my_directory_entry`), so the public list and detail page should share one source of truth.

- `src/routes/directory.tsx`: remove the `member_profiles` query and the synthesized `member-{id}` rows. List only `directory_entries` where `published = true AND status = 'approved'`, ordered by `featured`, `display_order`, `company_name`.
- `src/routes/directory.$slug.tsx`: tighten the loader to also require `status = 'approved'` so suspended/rejected entries 404 instead of leaking.
- Keep `member_profiles.directory_visible` toggle in `admin.directory.tsx` as-is (separate admin view) — out of scope here.

### 2. Bulk actions in `admin.directory-entries.tsx`

Add a leftmost checkbox column + header "select all (filtered)" checkbox, plus a sticky bulk-action bar that appears when ≥1 row is selected:

- **Approve selected** — loop `admin_review_directory_entry(id, 'approve')`.
- **Suspend selected** — loop `admin_review_directory_entry(id, 'suspend')`.
- **Reject selected** — loop `admin_review_directory_entry(id, 'reject')`.
- **Link to member…** — opens a member picker (search `member_profiles` by company / contact / email / member_id, approved + active subscription preferred). On confirm: update each selected entry with `user_id = picked.user_id` (admin RLS already permits). Block if any selected row already has a different `user_id` unless the admin confirms overwrite. Show toast with success/failure counts.
- **Unlink member** — sets `user_id = null` on selected rows.
- Clear selection on filter change and after each bulk action; refresh list.

State: `selectedIds: Set<string>` in component; selection is preserved across pagination only if we add pagination later (currently full list).

### 3. Member-side visibility of linked entries

Already wired: `MyDirectoryListingTab` loads `directory_entries` by `user_id = auth.uid()` and edits it through `submit_my_directory_entry`, which upserts by `user_id`. Once admin sets `user_id` on an entry (Step 2), the member sees and can edit it with no extra code.

Add one small safeguard: in `MyDirectoryListingTab`, when the loaded entry has `status = 'approved'`, show a notice that editing will return it to `pending` for re-review (the RPC already does this; just surface it in UI).

### 4. New component

- `src/components/admin/MemberPickerDialog.tsx` — modal with debounced search over `member_profiles` (name/email/company/member_id), returns `{ user_id, member_id, company_name, contact_name }` to caller. Reused by single-entry edit modal too (replace the inline picker reference mentioned in earlier work if not already a shared component).

## Files touched

- Edit: `src/routes/directory.tsx`
- Edit: `src/routes/directory.$slug.tsx`
- Edit: `src/routes/admin.directory-entries.tsx`
- Edit: `src/components/dashboard/MyDirectoryListingTab.tsx` (status notice only)
- New: `src/components/admin/MemberPickerDialog.tsx`

No DB migration needed — `admin_review_directory_entry` RPC and admin RLS on `directory_entries` already support every action above.

## Out of scope

- Email notifications on approve/suspend/link.
- Multiple directory entries per member.
- Pagination of the admin entries table.
