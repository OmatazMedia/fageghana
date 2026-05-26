# Account Self-Service for All Users

Give every authenticated user (admin, staff, moderator, member) a unified **Account Settings** area to manage their own credentials and security — regardless of which dashboard they log into.

## Scope

A single shared route `/account` with tabbed sub-routes, accessible from both the admin shell (`/admin`) and the member dashboard (`/dashboard`) via a user menu / avatar dropdown.

## Tabs

### 1. Profile
- Edit full name, phone, avatar (upload to existing `content` storage bucket)
- For members: also company name, position, country, bio
- Email shown read-only here (change handled in Security tab — requires verification)

### 2. Security
- **Change password** (already exists at `/account/change-password` — fold into this tab)
- **Change email** — uses `supabase.auth.updateUser({ email })`, sends confirmation to both old + new addresses
- **Two-Factor Authentication (TOTP)** — enroll/disable via `supabase.auth.mfa.enroll()` + `verify()`; show QR code + recovery codes. Use Supabase's native TOTP MFA (already supported on the project).
- **MFA on login** — once enrolled, the login flow prompts for the 6-digit code (extend `/admin/login` and `/login` to handle `aal2` challenge via `supabase.auth.mfa.challengeAndVerify`).
- Optional: enforce MFA for admin/staff/moderator roles (flag in `user_roles`-adjacent settings table, or simple check on admin layout)

### 3. Sessions & Devices
- List active sessions (via `supabase.auth.admin.listUserSessions` through a `createServerFn` with admin client scoped to `auth.uid()`)
- "Sign out of this device" / "Sign out everywhere" buttons

### 4. Notifications (suggested addition)
- Toggle email notifications (already a `notification_preferences` pattern in the codebase — wire up here)
- Choose digest frequency

### 5. Danger Zone (member-only)
- Request account deletion (soft-delete flag → admin reviews in `/admin/users`)
- Admin/staff/moderator accounts cannot self-delete (must be removed by another admin)

## Additional suggestions worth including

- **Last login + login history** — small audit log table (`auth_events`: user_id, event, ip, user_agent, created_at) populated via `onAuthStateChange`, shown in Security tab
- **Connected accounts** — if Google OAuth is enabled, show linked providers with unlink option
- **Recovery codes download** — generated alongside TOTP enrollment, downloadable as .txt
- **Password strength meter + HIBP check** — enable `password_hibp_enabled` via `configure_auth` so leaked passwords are rejected
- **Session timeout warning** — toast 2 min before token refresh fails

## Technical changes

**New files**
- `src/routes/account.tsx` — layout with sidebar tabs + `<Outlet />`
- `src/routes/account.profile.tsx`
- `src/routes/account.security.tsx` (absorbs existing change-password logic)
- `src/routes/account.sessions.tsx`
- `src/routes/account.notifications.tsx`
- `src/lib/account.functions.ts` — server fns: `updateProfile`, `listSessions`, `revokeSession`, `revokeAllOtherSessions`, `getLoginHistory`
- `src/components/account/MfaEnrollDialog.tsx`
- `src/components/account/MfaChallengeForm.tsx`

**Edited files**
- `src/routes/admin.login.tsx` & `src/routes/login.tsx` — handle MFA challenge after password success
- `src/routes/admin.tsx` — add user menu with "Account Settings" + "Sign out"
- `src/routes/dashboard.tsx` — same user menu
- `src/components/auth/AuthProvider.tsx` — expose MFA helpers, AAL level

**Database migration**
- `auth_events` table (user_id, event_type, ip, user_agent, created_at) + RLS: user can read own
- Optional `account_preferences` table (user_id, require_mfa, notification_email_enabled, …)

**Auth config**
- Enable `password_hibp_enabled: true` via `configure_auth`
- MFA (TOTP) is enabled by default on Supabase — no config change needed

## Open questions

1. Should MFA be **required** for admin/staff/moderator on next login, or **optional** (recommended only)?
2. Should the existing `/account/change-password` URL stay (redirect to `/account/security`) or be removed?
3. For members specifically: do you want the Profile tab to write to the existing `members` table fields, or a separate `profiles` table?
