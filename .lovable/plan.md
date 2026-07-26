## Goal

Close the three warn-level policy leaks flagged by the scanner while keeping every existing user flow working. All three fixes are policy-only — no schema, no code changes required (verified below).

## Findings and confirmed impact

**1. `member_profiles` — "Members view directory rows" leaks email/phone to every logged-in member.**
Current policy: `authenticated` may SELECT any row where `status='approved' AND directory_visible=true`, returning full columns including `email`, `phone`, `company_name`.
Verified by codebase search: no client code queries `member_profiles` for other members — the directory UI now reads from `directory_entries` (which has its own vetting workflow). Every other `member_profiles` read is either (a) scoped to `auth.uid() = user_id` via the "Members view own profile" policy, or (b) admin/staff/service_role. This policy is unused legacy.

**2. `member_id_counters` — "read counters" returns `next_seq` to every authenticated user.**
Current policy: `USING (true)` for `authenticated`.
Verified: only `generate_structured_member_id` (SECURITY DEFINER) touches this table. Client code never reads it.

**3. `role_permissions` — "role_perms read" returns the full role→permission matrix to every authenticated user.**
Current policy: `USING (true)` for `authenticated`.
Verified: `useRolePermissions` in `src/lib/role-permissions.ts` loads rows only to gate the current user's own UI. It only needs rows for roles the user actually holds — it never displays other roles' matrices (that surface is `/admin/roles`, already gated to admin/superadmin by the manage policy).

## Migration (single call)

```sql
-- 1) member_profiles: drop the directory-wide SELECT policy.
DROP POLICY IF EXISTS "Members view directory rows" ON public.member_profiles;
-- Own-profile, admin, and staff SELECT policies remain intact.

-- 2) member_id_counters: restrict SELECT to admin/staff.
DROP POLICY IF EXISTS "read counters" ON public.member_id_counters;
CREATE POLICY "Admins and staff read counters"
  ON public.member_id_counters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'staff'::app_role)
      OR public.has_role(auth.uid(),'superadmin'::app_role));
-- generate_structured_member_id is SECURITY DEFINER so it keeps writing/reading fine.

-- 3) role_permissions: users only see rows for roles they actually hold.
DROP POLICY IF EXISTS "role_perms read" ON public.role_permissions;
CREATE POLICY "Users read their own role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'superadmin'::app_role)
    OR public.has_role(auth.uid(), role)
  );
-- Admin manage policy is unchanged, so /admin/roles keeps full visibility.
```

## Why nothing breaks

- `useRolePermissions` merges overrides into a local `Map` and applies them per role using `has_role(auth.uid(), role)`. Filtering server-side to those same roles returns the exact subset the hook already needed.
- No feature reads `member_profiles` cross-user via the browser, so dropping the directory policy is a no-op for the app.
- `member_id_counters` is written/read only inside SECURITY DEFINER functions.

## Verification after apply

- Sign-in as a plain member → dashboard, sidebar gating, and directory listing behave unchanged.
- `/admin/roles` still lists the full matrix for admin/superadmin.
- New member creation still generates a correctly-formatted Member ID (counter advances).
- Re-run the security scan to confirm the three findings clear.
