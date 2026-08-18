# Readiness, Members CSV, Profile & 2FA, Member IDs, Event Gallery

## 0. Fix current build break (first)
Navigating to `/dashboard` now requires the `tab` search param, so seven call sites (login, apply, payment callback, receipt, reset password) fail typecheck. Make the dashboard's `tab` param optional so plain `/dashboard` links compile and default to the Overview tab.



## 1. Readiness tab cleanup
- Remove the **Weight** column from the readiness checklist table and the weight input from the add/edit form (weight stays in the database at its default so existing score calculations keep working).
- Rename **Display order** to **Serial No.** in the table header and the form label; rows keep their drag/move-up-down reordering, and the serial number shown is the row's position (1, 2, 3 …).

## 2. Members: import users via CSV (email, name, password)
- Update the bulk-import dialog to accept `email, full_name, password` plus the optional `phone, company_name, tier` columns.
- Add a **Download sample CSV** button in the dialog that generates a ready-to-fill template with the header row and one example row.
- Validation per row: valid email, non-empty name, password at least 8 characters (rows with problems are listed and skipped).
- On import, each account is created already confirmed with the given password so the member can sign in immediately, and a branded welcome email is sent telling them their account is ready (login link, their email, and a note to change the password after first sign-in).
- Passwords are only sent to the server for account creation — never stored in our own tables or logged.

## 3. Account & Security page
**Profile card (new, at the top)**
- Avatar with upload/replace/remove, full name, phone, bio, and (for members) company name.
- Saved to a new `profiles` record per user so admins and staff also have a profile, and shown in the top-bar avatar dropdown.

**Change password**
- Require the current password first (verified before the change), plus a live password-strength meter and a minimum-strength requirement with clear rules.

**Two-factor authentication**
- Keep the existing authenticator-app (TOTP) method.
- Add **Email OTP** as a second method: enabling it sends a 6-digit code to the account email, which must be entered to confirm. On sign-in, email-2FA users get a code by email.
- Turning **either** method off now requires a valid current code (authenticator code, or an emailed code) before it is removed.

## 4. Membership plans & Member ID numbering
- Final format: `FAGE/{ABBR}/{YY4}/{SEQ5}` — e.g. `FAGE/AS/0026/00001`.
  - `FAGE` constant prefix; `AS` Associate, `CR` Corporate, `SB` Standard/Start-up Business.
  - Year block is the 2-digit enrolment year zero-padded to 4 characters (2026 → `0026`).
  - Sequence is the member's order in the register, zero-padded to 5 digits.
- Plans page: each plan shows its abbreviation (editable), a live preview of the next ID for that plan, and the existing "next sequence number" control.
- Existing member IDs and certificate numbers issued with the old `2026` block are re-generated into the new `0026` format, keeping each member's sequence number so no one's position changes. Certificate verification keeps working for previously issued codes.

## 5. Event gallery (public)
- New public **Gallery** page listing event albums (cover image, title, date, item count), plus an album page showing all photos and videos in a grid with a lightbox, a **Download** button per item, and **Download all** for the album.
- New admin page **Gallery** (admin-only): create/edit/delete albums, upload multiple images and videos into an album, reorder, set the cover, and publish/unpublish.
- Gallery link added to the site navigation and footer, with page metadata for sharing.

## Technical notes
- Migrations: `profiles` table (avatar, full name, phone, bio) with owner-scoped policies and grants; `user_mfa_email` (enabled flag, hashed OTP, expiry) with owner-scoped policies; `gallery_albums` and `gallery_items` with public read of published rows and admin write; updated `generate_structured_member_id` for the `0026` year block plus a one-off backfill of `member_profiles.member_id` and `certificates`.
- Storage: `avatars` bucket (public read, owner write) and reuse of the existing content bucket for gallery media.
- Server functions: bulk import extended to set passwords and send the welcome email; email-OTP send/verify; current-password verification for password change; each verifies the caller and (for admin actions) the admin/developer role.
- Readiness change is presentation-only; `weight` column and scoring RPC stay untouched.
