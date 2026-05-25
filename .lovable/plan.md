## 1. Members page improvements (`src/routes/admin.members.tsx`)

**Sticky table header + scrollable body**
- Wrap the members table in a fixed-height scroll container (`max-h-[calc(100vh-280px)] overflow-auto`).
- Apply `sticky top-0 z-10 bg-background` to `<thead>` so the header stays visible while rows scroll.

**Create-member modal: fixed size, no expansion**
- Remove any expand/animate-in scale transitions on the modal shell.
- Render the dialog at its natural width/height immediately (no progressive grow). Keep all form fields visible on open at a fixed `max-w-2xl`.

**Pagination with page-size selector**
- Add client-side pagination over the filtered rows.
- Default page size = 50. Selector dropdown options: **25 / 50 / 100 / 200**, placed to the **left** of the prev/next pagination controls.
- Show "Showing X–Y of Z" between selector and pagination buttons.
- Reset to page 1 when search query or page size changes.

## 2. New: Admin Users management

**Roles**
Extend the `app_role` enum to include two new roles in addition to existing `admin`:
- `staff` — view + manage member records (no delete, no role changes)
- `moderator` — content only (news, media, activities)

**Migration**
- `ALTER TYPE public.app_role ADD VALUE 'staff';`
- `ALTER TYPE public.app_role ADD VALUE 'moderator';`
- Add RLS policies for `staff` on `member_profiles` (SELECT + UPDATE, no DELETE) and `moderator` on `news`, `media`, `activities` (ALL).
- Keep existing `admin` policies untouched.

**New route `/admin/users`**
New file `src/routes/admin.users.tsx` listing every account that has a role in `user_roles` (joined with auth metadata via a new server fn). UI:
- Table: Name / Email / Role badge / Created / Actions
- "Add user" button → modal: email, full name, password OR invite, role selector (admin / staff / moderator)
- Per-row actions: Change role, Delete account
- Sticky header, search filter, same pagination pattern as Members
- Self-protection: cannot demote or delete own account

**Server functions — new file `src/server/users.functions.ts`**
- `listAdminUsers()` — admin-only. Uses `supabaseAdmin.auth.admin.listUsers()` joined with `user_roles` to return only users that have any role.
- `createAdminUser({ email, full_name, password?, mode, role })` — admin-only. Creates auth user (password or invite), inserts row in `user_roles`. No `member_profiles` entry.
- `changeUserRole({ user_id, role })` — admin-only. Replaces the user's role row.
- `deleteAdminUser({ user_id })` — admin-only. Removes role + auth user. Blocks self-delete.

**Sidebar entry**
Add "Users" item to the admin sidebar (`src/routes/admin.tsx`) pointing to `/admin/users`, visible to admins only.

## Out of scope
- Granular per-table permission editor (only the 3 fixed roles above)
- Audit log of role changes
- Inviting via OAuth (email/password and invite-by-email only)

## Files touched
- `src/routes/admin.members.tsx` (sticky header, modal sizing, pagination)
- `src/routes/admin.users.tsx` (new)
- `src/server/users.functions.ts` (new)
- `src/routes/admin.tsx` (sidebar item)
- One new SQL migration for enum values + RLS for staff/moderator
