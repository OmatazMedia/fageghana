## 1. Directory detail page not showing content

**Cause:** The current `directory.tsx` list query only returns rows where `published = true AND status = 'approved'` — that part works. But the **detail** page (`directory.$slug.tsx`) is also gated on both flags, and most existing entries in the DB have `status != 'approved'` (still `pending` or `draft`) after recent migrations. Cards render from `directory.tsx` only when both flags are set, but several legacy cards still come through with stale slugs that 404 on the detail loader. We'll also ensure cards never render for rows the detail page would reject (already true), and surface admin-only entries the same way.

**Changes:**
- No query change needed in `directory.$slug.tsx` (already filters published+approved). Verify and add an `is_active` check (see §2).
- Re-confirm the list and detail filters are identical: `published = true AND status = 'approved' AND is_active = true`.
- If admins want to preview unapproved entries, add a `?preview=1` admin-only branch in the loader using `requireSupabaseAuth` + `has_role('admin')`.

## 2. Admin-owned entries + deactivate flag

**Schema (migration):**
- Add `directory_entries.is_admin_owned boolean NOT NULL DEFAULT false`.
- Add `directory_entries.is_active boolean NOT NULL DEFAULT true` (admin "deactivate" toggle; distinct from `status='suspended'` which means rejected-by-review).
- Update RLS public SELECT policies to also require `is_active = true`.
- Update `admin_review_directory_entry` to support `'deactivate'` and `'activate'` actions that flip `is_active`.

**Admin UI (`admin.directory-entries.tsx`):**
- New bulk + row actions: **Deactivate** / **Activate**.
- Column showing `Admin-owned` badge when `is_admin_owned = true` or `user_id IS NULL`.
- "Create entry" admin form sets `is_admin_owned = true` and skips the member-link requirement; admin can later link a member to convert.

**Public flow:** deactivated entries disappear from directory list + detail (404). Member can still see the entry in their dashboard with a banner explaining it's deactivated by admin.

## 3. Admin sign-in race ("error then eventually signed in, then bumps to membership portal")

**Root cause** (confirmed in `AuthProvider.tsx` + `admin.tsx` + `admin.login.tsx`):
- `AuthProvider` exposes `loading`, `user`, `isAdmin`. After sign-in, `loading` flips to `false` and `user` is set **before** the async `checkAdminRoleSync` resolves. There's a window where `!loading && user && !isAdmin === true` → `admin.tsx`'s effect calls `navigate({ to: "/" })`.
- Later, when admin nav links are clicked, the same race fires on every route mount because `isAdmin` is recomputed asynchronously via `onAuthStateChange`, briefly reading `false` again → user gets bounced to `/` (which redirects expired/non-admin sessions toward `/dashboard`/membership).

**Fix:** Track role-check completion explicitly in `AuthProvider`:
- Add `roleChecked: boolean` to context; set `false` whenever a new session arrives, `true` after `checkAdminRoleSync` resolves.
- In `admin.tsx`, gate the redirect: `if (!loading && roleChecked && user && !isAdmin) navigate("/")`. Show the loader while `!roleChecked`.
- In `admin.login.tsx`, gate the post-login redirect on `roleChecked` too.
- Stop calling `checkAndLoadSession()` after subscribing — `onAuthStateChange` already fires an `INITIAL_SESSION` event; the double-fetch is what creates the second race. Replace with a single subscribe that handles both initial and subsequent events; only flip `loading=false` after the first event resolves (including role check).
- After `signOut`, clear `isAdmin` and `roleChecked` immediately so stale state never leaks across accounts.

## 4. Bulk CSV upload of members (email-invite flow)

**Admin UI (`admin.users.tsx` → new "Bulk import" panel):**
- Upload CSV with columns: `email, full_name, phone, company_name, tier`.
- Client parses + validates with Zod, shows preview table with per-row errors.
- On "Import", calls a new `bulkInviteMembers` server function.

**Server (`src/lib/users.functions.ts`):**
- New `bulkInviteMembers` createServerFn with `requireSupabaseAuth` + admin check.
- Loops rows; for each: `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/auth/set-password })` and inserts/updates `member_profiles` row with provided fields (no subscription yet — admin can attach a plan after).
- Returns `{ succeeded, failed: [{email, reason}] }` summary; admin sees toast + table.

**Recipient flow:** Lovable auth email "Invite" template sends a magic link; clicking it lands on `/auth/set-password` where they set a password and are logged in. Then they pick/pay a subscription as normal.

(Auth emails are already managed; no new template scaffolding needed unless `scaffold_auth_email_templates` hasn't been run — verify and call once if missing.)

## 5. Expired / suspended member experience

**Decision (per your answer):** can log in, dashboard locked to a renewal screen.

**Implementation:**
- `dashboard.tsx`: read `member_profiles.subscription_expiry` and `member_profiles.status`. If expired (`expiry < now()`) or `status = 'suspended'`, render a full-page `<SubscriptionLockedScreen />` instead of tabs. The screen shows: status reason, expiry date, current plan, **Renew** button (opens existing payment flow), and a "Sign out" link. Only Account/Security and Invoices remain reachable via small footer links.
- `MyDirectoryListingTab` editor is already gated by `submit_my_directory_entry` (requires active subscription) — we'll add a friendlier UI banner instead of a raw error.
- Public directory: existing `directory_entries` policies only show `published+approved+is_active`; member's listing remains visible to public as long as admin keeps it approved. Optionally add a cron-style check that auto-unpublishes listings whose owner's subscription lapsed by >30 days (out of scope unless you want it).

## Technical summary

**Migrations**
- `directory_entries`: add `is_active`, `is_admin_owned`; update SELECT RLS + `admin_review_directory_entry` RPC; backfill `is_active=true`.

**Server functions**
- `src/lib/users.functions.ts`: `bulkInviteMembers`.
- `src/lib/directory.functions.ts` (new or extend existing): `adminToggleDirectoryActive`, `adminCreateDirectoryEntry` (for admin-owned).

**Components / routes**
- `src/components/auth/AuthProvider.tsx`: add `roleChecked`, fix race.
- `src/routes/admin.tsx`, `src/routes/admin.login.tsx`: gate redirects on `roleChecked`.
- `src/routes/admin.directory-entries.tsx`: Activate/Deactivate bulk + row actions, admin-owned badge, "Create admin-owned entry" dialog.
- `src/routes/admin.users.tsx`: Bulk CSV import panel + preview.
- `src/routes/dashboard.tsx`: subscription-locked screen + banner on directory tab.
- `src/components/dashboard/SubscriptionLockedScreen.tsx`: new.

**Out of scope**
- Auto-unpublishing listings after grace period.
- Per-row CSV password assignment (we're using invites only).
- Admin "impersonate member" preview of unapproved entries (mentioned as optional).