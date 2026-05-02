## What I found

### Why `/admin/login` is stuck on “Loading…”
The `/admin/login` route currently lives under the `/admin` layout. That parent admin layout checks for an already-signed-in admin before rendering any child route. So when a visitor goes to `/admin/login`, the parent route blocks it and shows `Loading…`/redirect logic instead of allowing the login form to render.

### Why the membership login/dashboard is missing
Only the public `/membership` page and public application form exist right now. There is no member login route, no protected member dashboard route, and no member profile/dashboard database tables yet.

### Admin auto-grant status
A migration file exists for auto-granting `omatazmedia@gmail.com` admin access on signup, but the current live database metadata shows no auth trigger installed. I will re-apply/fix that via a migration so the role is actually granted on registration and backfilled for the existing user if already created.

## Already done

- Public website pages: Home, Who We Are, Products, Services, News, Media, Activities, Membership.
- Public membership application form at `/membership`.
- Membership applications table and admin review workflow.
- Admin CMS routes for News, Products, Activities, Media, and Applications.
- Admin applications page can review applications, update status, add admin notes, and delete applications.
- Navbar About dropdown grouping Who We Are, Products, Services.
- Search and user icons added to navbar.
- Homepage service section updated to 4 service cards on the left and details on the right.
- Scroll reveal and animated stats components were added.

## Remaining / not yet done

- Fix `/admin/login` route rendering.
- Ensure `omatazmedia@gmail.com` is automatically granted the highest admin access when signing up.
- Add a dedicated membership login/signup page.
- Add a protected member dashboard.
- Add member profile/company records tied to authenticated users.
- Connect membership application records to member accounts so members can see their own application status.
- Add member-facing dashboard pages/components for profile, application status, resources, and account actions.
- Update navbar user icon to point to member login/dashboard instead of only admin login.
- Add proper RLS policies so members can only view/update their own data while admins can manage all records.

## Implementation plan

### 1. Fix `/admin/login`
- Move the admin login page outside the protected `/admin` layout so it can render publicly.
- Keep `/admin` and all admin content protected.
- Update route generation naturally by adding/renaming route files instead of manually editing `routeTree.gen.ts`.
- Keep admin auth checks server/database-backed through `user_roles`, not client-side storage.

### 2. Repair admin auto-grant for `omatazmedia@gmail.com`
- Add a database migration that ensures the signup trigger exists.
- Backfill admin role for `omatazmedia@gmail.com` if that account already exists.
- Keep roles in the separate `user_roles` table, following the existing secure pattern.
- Treat the existing `admin` role as the highest admin/super-admin role unless you want a separate `super_admin` role later.

### 3. Add membership database structure
Create secure member-focused tables, for example:

```text
member_profiles
- id
- user_id
- company_name
- contact_name
- phone
- country
- industry
- products_exported
- membership_tier
- status
- created_at
- updated_at

member_documents or member_resources access records, if needed later
```

Also update `membership_applications` to optionally connect an application to a logged-in member account.

RLS rules:
- Members can read/update only their own profile.
- Members can read only their own applications.
- Public visitors can still submit membership applications.
- Admins can read/update/manage all member profiles and applications.

### 4. Add membership auth flow
- Create `/member/login` for member login/signup.
- Use email/password auth.
- Add Google sign-in if the project auth settings support it.
- After signup/login, redirect members to `/member/dashboard`.
- If a signed-in user has no member profile yet, guide them through completing their company/member profile.

### 5. Add protected member dashboard
Create `/member/dashboard` with clear member-facing sections:

- Overview: membership tier, current status, quick actions.
- Application Status: submitted application, review status, admin notes if appropriate.
- Company/Profile: editable company/contact details.
- Membership Benefits: benefits by tier.
- Resources: placeholder/resource area for future downloadable member content.
- Support/Contact: quick contact CTA.

### 6. Connect public membership page to member login/dashboard
- Keep `/membership` as the public information + application page.
- Add clear CTAs:
  - “Apply for membership”
  - “Member Login”
  - “Go to Dashboard” when already signed in.
- Optionally let logged-in members prefill the application form from their profile.

### 7. Update navbar behavior
- Change the navbar user icon to point to member login/dashboard.
- Keep admin login accessible from the top utility bar or footer, but not confuse it with member login.
- Add a visible “Member Login” path where appropriate.

### 8. QA after implementation
- Open `/admin/login` unauthenticated and confirm the form renders instead of `Loading…`.
- Register/sign in with `omatazmedia@gmail.com` and confirm admin access.
- Open `/member/login`, create a member account, and confirm redirect to dashboard.
- Submit a membership application and confirm it appears in admin applications.
- Confirm RLS behavior: members cannot see other members’ data; admins can manage all.
- Check console/network logs for auth or routing errors.

## Expected result

After this is implemented:

- `/admin/login` will work correctly.
- `omatazmedia@gmail.com` will receive admin access on registration.
- Members will have their own login and dashboard.
- Public membership applications will still work.
- Admins will be able to review and manage membership applications.
- Member data will be protected by proper database access rules.