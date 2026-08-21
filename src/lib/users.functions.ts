// @ts-nocheck
import { z } from "zod";
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

const roleEnum = z.enum([
  "admin",
  "superadmin",
  "staff",
  "moderator",
  "finance",
  "ceo",
  "developer",
  "coordinator",
]);

/** Full-access roles: `developer` is a super-admin equivalent. */
const FULL_ACCESS_ROLES = ["admin", "superadmin", "developer"] as const;

async function assertAdmin(): Promise<string> {
  const { data } = await api.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const roles = Array.isArray(data?.user?.roles)
    ? data.user.roles.map((r: any) => (typeof r === "string" ? r : r?.role))
    : [];
  if (!roles.some((r) => (FULL_ACCESS_ROLES as readonly string[]).includes(r))) {
    throw new Error("Forbidden: admin only");
  }
  return userId;
}

function randomPassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => chars[b % chars.length])
    .join("");
}

export type AdminUserRow = {
  user_id: string;
  email: string;
  full_name: string;
  role:
    | "admin"
    | "superadmin"
    | "staff"
    | "moderator"
    | "finance"
    | "ceo"
    | "developer"
    | "coordinator";
  created_at: string;
};

export async function listAdminUsers(_input?: any): Promise<{ users: AdminUserRow[] }> {
  await assertAdmin();

  const { data: res, error } = await api.request("/admin/users");
  if (error) throw new Error(error.message);

  const r = unwrap(res);
  const rows = Array.isArray(r) ? r : Array.isArray(r?.data) ? r.data : [];

  const users: AdminUserRow[] = rows.map((u: any) => ({
    user_id: u.id,
    email: u.email ?? "",
    full_name: u.name ?? u.full_name ?? "",
    role: Array.isArray(u.roles)
      ? ((typeof u.roles[0] === "string" ? u.roles[0] : u.roles[0]?.role) ?? u.role ?? "")
      : (u.role ?? ""),
    created_at: u.created_at,
  }));

  users.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { users };
}

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: roleEnum,
  mode: z.enum(["password", "invite"]),
  password: z.string().min(6).optional(),
});

export async function createAdminUser(input: any): Promise<{ userId: string }> {
  const data = input?.data ?? input;
  const d = createSchema.parse(data);
  await assertAdmin();

  const password = d.password ?? randomPassword();

  const { data: res, error } = await api.request("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      name: d.full_name,
      full_name: d.full_name,
      email: d.email,
      password,
      role: d.role,
    }),
  });
  if (error) throw new Error(error.message);

  return { userId: unwrap(res)?.id ?? res?.id };
}

const changeRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: roleEnum,
});

export async function changeUserRole(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = changeRoleSchema.parse(data);
  const userId = await assertAdmin();
  if (d.user_id === userId && !(FULL_ACCESS_ROLES as readonly string[]).includes(d.role)) {
    throw new Error("You cannot demote your own admin account.");
  }

  const { error } = await api.request(`/admin/users/${d.user_id}/role`, {
    method: "PUT",
    body: JSON.stringify({ role: d.role }),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

const deleteSchema = z.object({ user_id: z.string().uuid() });

export async function deleteAdminUser(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = deleteSchema.parse(data);
  const userId = await assertAdmin();
  if (d.user_id === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const { error } = await api.request(`/admin/users/${d.user_id}`, { method: "DELETE" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* ── Bulk member CSV invite ─────────────────────────────────────────── */

const bulkRowSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(72).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  company_name: z.string().trim().max(160).optional().nullable(),
  tier: z.enum(["associate", "standard", "corporate"]).optional().nullable(),
});

const bulkInviteSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(500),
  redirectOrigin: z.string().url(),
});

export type BulkInviteResult = {
  succeeded: number;
  failed: { email: string; reason: string }[];
};

export async function bulkInviteMembers(input: any): Promise<BulkInviteResult> {
  const data = input?.data ?? input;
  const d = bulkInviteSchema.parse(data);
  await assertAdmin();

  // The backend creates the users/profiles and sends the welcome emails server-side.
  const { data: res, error } = await api.request("/admin/members/bulk-invite", {
    method: "POST",
    body: JSON.stringify({ rows: d.rows, redirectOrigin: d.redirectOrigin }),
  });
  if (error) throw new Error(error.message);

  const r = unwrap(res);
  return {
    succeeded: r?.succeeded ?? 0,
    failed: Array.isArray(r?.failed) ? r.failed : [],
  };
}
