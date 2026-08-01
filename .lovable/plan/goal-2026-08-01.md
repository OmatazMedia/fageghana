## Goal

Lock down the admin console entrance: an unlinked login page, a two-step (email-then-password) form, IP throttling with warnings and 24-hour bans, an admin ban manager, custom password-reset checks, plus login-alert emails for new devices and idle-session termination.

## 1. Hidden admin entrance + catch-all redirect

- Remove every link/button pointing to `/admin/login` across the site (header, footer, member login page, any CTA). The URL keeps working when typed directly, so admins can never be locked out.
- Add a catch-all route so any unmatched URL (`/adminn`, `/admin/foo`, typos, probing paths) redirects to the homepage instead of showing the 404 card. The root 404 component is replaced by a redirect.
- `/login` (member login) stays public and linked exactly as today.
- Existing real admin pages keep their current role gate: signed-out visitors to `/admin/...` land on the homepage rather than a login screen, since the login page is unlinked.

## 2. Two-step admin login form

Step 1 — email only:
- Input is sanitised: trimmed, lowercased, max 254 chars, strict email pattern. Anything containing SQL/NoSQL-style syntax (quotes, `;`, `--`, `/*`, `=`, `<`, `>`, `{`, `}`, `$`) is rejected before it ever reaches the server.
- A server check confirms the address belongs to an account with a console role (admin, superadmin, developer, staff, finance, ceo, coordinator).
- Recognised → the password field slides in, with the email shown and an "Use a different email" link.
- Not recognised → "This email is not recognised for admin access." and the attempt is counted.

Step 2 — password:
- Password field only exists after a successful email check, so credential-stuffing bots must pass step 1 first.
- Existing MFA challenge and role verification flow is preserved.

Note: the email check is deliberately rate-limited and IP-counted, because it does reveal whether an address is a console account. The throttle in section 3 is what keeps it from being used for enumeration.

## 3. Throttling, warnings and bans

Server-side counters keyed by IP (and `/24` subnet):

| Trigger | Result |
|---|---|
| Failed email check or wrong password | attempt recorded with IP, email tried, reason |
| 5 attempts in 15 min | Warning 1 — "5 failed attempts. After 3 warnings this network will be blocked for 24 hours." |
| Next 5 attempts | Warning 2, then Warning 3 |
| 3rd warning reached | IP **and its `/24` subnet** banned for 24 hours |

- Warnings are shown in the form with the remaining-attempt count so the user knows exactly where they stand.
- While banned, `/admin/login` itself redirects to the homepage — no form, no message, no matter how it is reached.
- Successful sign-in clears that IP's attempt counters and warnings.
- Every warning and ban writes an `activity_log` entry and an admin notification.

## 4. Admin ban manager

New admin page **Security → Login Attempts & Bans** (visible to admin / superadmin / developer):

- **Bans tab:** active and expired bans — IP, subnet, warning count, banned at, expires at, last email tried — with **Unban** (for bans made in error) and manual **Ban an IP**.
- **Attempts tab:** paginated recent attempts with filters by IP, email and outcome, so a genuine lockout can be diagnosed.
- Unbanning clears counters and warnings for that IP so the user gets a clean slate.

## 5. Forgot password (admin)

- The reset form checks the email against console accounts first. Unknown → "This email is not recognised for admin access." Known → the reset email is sent and a confirmation is shown.
- The reset email is a branded FAGE template (logo header, reset button, expiry note, footer) matching the existing email designs, and reset attempts are IP-counted like sign-in attempts.

## 6. Login alert emails (new device only)

- After each successful sign-in — member or console — the system compares the device fingerprint/IP against that user's known sessions.
- New device or new network → a branded "New sign-in to your FAGE account" email with device (browser + OS), IP, approximate location (country/city from IP), and timestamp in Ghana time, plus a prominent **"This wasn't me — reset my password"** button that starts a password reset and signs out all other sessions.
- Known device → no email, so regular daily logins don't spam inboxes.

## 7. Idle session termination and hijack protection

The session guard already built (15-minute idle detection, "Are you still there?" 60-second countdown modal, 12-hour hard cap, device registry with heartbeats, fingerprint/IP anomaly revocation, full storage and cache purge on sign-out) covers this requirement. This phase verifies and finishes it:

- Confirm the countdown modal appears on both member and admin dashboards and that hitting 0 terminates the session and returns the user to the correct login route.
- Confirm anomaly detection (changed fingerprint or a network jump) revokes the session and logs it for admins.
- Fix a server-rendering crash in the admin login page caused by reading browser storage during SSR (`localStorage is not defined`), which currently makes that page fall back to client rendering.

## Technical details

**Migration**
- `login_attempts` — ip, subnet, email_tried, outcome, user_agent, created_at; indexed on (ip, created_at).
- `ip_bans` — ip, subnet, reason, warning_count, banned_at, expires_at, unbanned_at/by, last_email_tried.
- Both tables: no anon/authenticated grants; all reads/writes go through security-definer RPCs and service-role server functions. Admin read/unban gated by `has_role`.
- RPCs: `record_login_attempt`, `check_ip_status` (returns banned / warning level / attempts left), `admin_unban_ip`, `admin_ban_ip`, `admin_list_login_attempts`.
- Email template rows for `admin_password_reset` and `login_alert`.

**New files**
- `src/routes/$.tsx` — catch-all redirecting to `/`.
- `src/lib/login-security.functions.ts` — `checkAdminEmail`, `recordAttempt`, `ipStatus`, `unbanIp` (IP read from request headers server-side).
- `src/lib/email-templates/login-alert` + `admin-password-reset` rendering via the existing branded email pipeline.
- `src/routes/admin.login-security.tsx` — bans + attempts UI.

**Edited**
- `src/routes/admin.login.tsx` — two-step form, sanitisation, ban gate, warning banners, SSR-safe storage reads.
- `src/routes/__root.tsx` — 404 becomes a homepage redirect.
- `src/components/site/SiteHeader.tsx` / `SiteFooter.tsx` / `src/routes/login.tsx` — remove admin-login links.
- `src/components/auth/AuthProvider.tsx` — fire the new-device login alert after sign-in.
- `src/lib/role-permissions.ts` + admin sidebar — register the new Login Security page.

**Not changed:** member sign-in flow, roles, subscription logic, or any existing business rules.

**Trade-off worth knowing:** banning a whole `/24` subnet for 24 hours can catch colleagues on the same office network as a careless typist. The unban tool makes that a one-click fix, and the ban only triggers after 15 failed attempts across three warnings.
