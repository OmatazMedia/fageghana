# Roles, auto sign-out, help guide, certificate designer polish

## 1. Fix duplicate role rows (Developer showing twice)

Confirmed in the database: one account (`omatazmedia@gmail.com`) holds **two** role rows — `admin` and `developer` — so User Management lists it twice, once per role.

Cause: when you add a role for an email that already has an account, the create path adds a new role row instead of replacing the existing one.

Fix:
- One role per user, enforced at the database level (a unique constraint on user id) and in the create path: if the account already exists, replace its role instead of adding another row.
- Clean up the existing duplicate: keep `developer`, drop the extra `admin` row for that account.
- Treat **Developer** as a super-admin everywhere: full access to every admin section and every action, identical to Admin. It already bypasses the permission matrix in the sidebar; the same bypass will be applied to the server-side admin checks (currently they require the literal `admin` role, so a pure Developer account would be refused on user management, backups, etc.).
- In Role Permissions, Developer is shown as "full access — not configurable" rather than a column of checkboxes, matching Admin/Superadmin.

## 2. Inactivity auto sign-out with countdown + beep

Today: 15 min idle, then a 60-second modal, hard-coded.

Changes:
- Admin-set inactivity timeout (a new setting on the Login Security page): choose minutes (e.g. 5 / 10 / 15 / 30 / 60), separately for member accounts and console accounts, plus the countdown length (default 10 seconds).
- Countdown modal shows a large ticking number, plays a short beep each second (Web Audio, no asset file), and can be silenced by the user in their Account & Security page ("sound on inactivity warning").
- On reaching 0: full sign-out — cancel queries, clear the query cache and app storage, revoke the device session row, end the auth session, redirect to the right login page. This already exists as the single sign-out path; the countdown simply calls it.
- Members get an option in Account & Security to shorten (not lengthen) their own idle limit below the admin value.

## 3. Role help guide

- New admin page **Help & Roles Guide** (`/admin/help`) plus a matching **Help** page in the member dashboard.
- Content is generated from the live permission matrix: each role gets a plain-language description (what the role is for), and a list of the sections it can currently open, so the guide stays correct when you change permissions.
- The page shows only what is relevant to the signed-in user's own role, with an "all roles" overview visible to Admin / Superadmin / Developer.
- Static per-role blurbs (Admin, Superadmin, Developer, Staff, Finance, CEO, Coordinator, Member) are editable text stored with the permission data so the secretariat can reword them without a code change.

## 4. Certificate designer: signer name toggle + signature size slider

- Eye icon next to each signer in the list and in the signer panel: toggles whether the **name** prints under the signature (independent of the existing "Visible on certificate" toggle which hides the whole signer).
- A single "Signature size" slider that scales the signature image proportionally (keeps aspect ratio), replacing the need to nudge width and height separately; width/height sliders remain for fine control.
- The canvas overlay and the exported PNG/PDF both honour the new name toggle and the proportional size.

## 5. Preview button with print-accurate rendering

- "Preview" button in the designer toolbar opens a modal that renders the certificate through the **same** renderer used for download (`renderCertificate` on a canvas at full template resolution), with sample data — not the drag-and-drop overlay.
- Guarantees what you see is what prints: the modal also offers PNG / PDF download from that exact canvas.
- Fixes fidelity gaps between the editor overlay and the renderer while doing this: fonts are awaited before drawing, the legacy single-signature block is not drawn when signers exist, and name placement uses the same offset maths in both paths.

## Technical notes

- Migration: unique index on `user_roles(user_id)`, dedupe existing rows, new `app_settings`-style rows for the idle timeout (or extra columns on the existing settings singleton), and a nullable `help_text` store for role blurbs.
- `src/lib/users.functions.ts`: `assertAdmin` accepts `admin | superadmin | developer`; `createAdminUser` upserts the role for pre-existing accounts.
- `src/components/auth/SessionGuard.tsx`: read timeout/countdown from settings via a small server function (cached), add beep via `AudioContext`, keep the existing single `signOut` exit path.
- `src/routes/admin.certificates.tsx` + `src/lib/certificate-render.ts`: add `showName` to the `Signer` type (defaults true for existing templates), proportional resize helper, and a shared preview modal component.
