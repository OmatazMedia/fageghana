// @ts-nocheck
import { api } from "@/integrations/api/client";
import { sanitizeEmail } from "@/lib/login-security.shared";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export type IpStatus = {
  banned: boolean;
  bannedUntil: string | null;
  warnings: number;
  recentFailures: number;
  attemptsLeft: number;
  message: string | null;
};

/** Ban/warning state for the caller's network. Called on page load (anonymous). */
export async function getLoginGate(): Promise<IpStatus> {
  const { data, error } = await api.request<any>("/public/login-security/gate");
  if (error) {
    return {
      banned: false, bannedUntil: null, warnings: 0,
      recentFailures: 0, attemptsLeft: 5, message: null,
    };
  }
  return unwrap(data) ?? {};
}

/** Step 1 of the admin sign-in: is this email an admin-console account? */
export async function checkAdminEmail(input: any) {
  const data = input?.data ?? input ?? {};
  const clean = sanitizeEmail(data.email ?? "");
  if (!clean.ok) {
    return {
      banned: false, ok: false,
      error: clean.error,
      status: { banned: false, bannedUntil: null, warnings: 0, recentFailures: 0, attemptsLeft: 5, message: null },
    };
  }
  const { data: res, error } = await api.request<any>("/public/login-security/check-email", {
    method: "POST",
    body: JSON.stringify({ email: clean.email }),
  });
  if (error) {
    return {
      banned: false, ok: false,
      error: "Could not verify that email right now. Try again shortly.",
      status: null,
    };
  }
  return unwrap(res) ?? {};
}

/** Record the outcome of the password step (called from the client after login responds). */
export async function recordPasswordOutcome(input: any): Promise<IpStatus> {
  const data = input?.data ?? input ?? {};
  const clean = sanitizeEmail(data.email ?? "");
  const { data: res, error } = await api.request<any>("/public/login-security/record-outcome", {
    method: "POST",
    body: JSON.stringify({
      email: clean.ok ? clean.email : "",
      success: !!data.success,
    }),
  });
  if (error) {
    return {
      banned: false, bannedUntil: null, warnings: 0,
      recentFailures: 0, attemptsLeft: 5, message: null,
    };
  }
  return unwrap(res) ?? {};
}

/** Branded password-reset email for console accounts only (anonymous). */
export async function requestAdminPasswordReset(input: any) {
  const data = input?.data ?? input ?? {};
  const clean = sanitizeEmail(data.email ?? "");
  if (!clean.ok) {
    return { ok: false, banned: false, error: clean.error, status: null };
  }
  const { data: res, error } = await api.request<any>("/public/login-security/request-reset", {
    method: "POST",
    body: JSON.stringify({ email: clean.email }),
  });
  if (error) {
    return {
      ok: false, banned: false,
      error: "Could not send a reset link right now. Try again shortly.",
      status: null,
    };
  }
  return unwrap(res) ?? {};
}

/* ───────── Admin-facing management ───────── */

async function assertSecurityAdmin() {
  const { data } = await api.auth.getUser();
  const roles: string[] = Array.isArray(data?.user?.roles)
    ? data.user.roles.map((r: any) => (typeof r === "string" ? r : r?.role ?? ""))
    : [];
  if (!["admin", "superadmin", "developer"].some((r) => roles.includes(r))) {
    throw new Error("Forbidden");
  }
}

export async function listIpBans(): Promise<any[]> {
  await assertSecurityAdmin();
  const { data, error } = await api.request<any>("/admin/login-security/ip-bans");
  if (error) throw new Error(error.message ?? "Failed to load IP bans");
  const payload = unwrap(data) ?? {};
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
  return rows;
}

export async function listLoginAttempts(input: any) {
  await assertSecurityAdmin();
  const data = input?.data ?? input ?? {};
  const page = Math.max(1, data.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, data.pageSize ?? 25));
  const params = new URLSearchParams();
  params.set("limit", String(pageSize));
  params.set("offset", String((page - 1) * pageSize));
  if (data.ip) params.set("ip", String(data.ip));
  if (data.email) params.set("email", String(data.email));
  if (data.outcome) params.set("outcome", String(data.outcome));

  const { data: res, error } = await api.request<any>(`/admin/login-security/login-attempts?${params.toString()}`);
  if (error) throw new Error(error.message ?? "Failed to load login attempts");
  const payload = unwrap(res) ?? {};
  const rows = Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
  const total = typeof payload.count === "number" ? payload.count : rows.length;
  return { rows, total, page, pageSize };
}

export async function unbanIp(input: any) {
  await assertSecurityAdmin();
  const data = input?.data ?? input ?? {};
  const { error } = await api.request("/admin/login-security/unban", {
    method: "POST",
    body: JSON.stringify({ id: data.id }),
  });
  if (error) throw new Error(error.message ?? "Could not unban that IP");
  try {
    await api.request("/member/activity-log", {
      method: "POST",
      body: JSON.stringify({ action: "login_ip_unbanned", details: `${data.id} unblocked by admin` }),
    });
  } catch {
    /* best-effort */
  }
  return { ok: true };
}

export async function banIpManually(input: any) {
  await assertSecurityAdmin();
  const data = input?.data ?? input ?? {};
  const ip = (data.ip ?? "").trim();
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) throw new Error("Enter a valid IP address");
  const hours = Math.min(24 * 365, Math.max(1, data.hours ?? 24));
  const { error } = await api.request("/admin/login-security/ban", {
    method: "POST",
    body: JSON.stringify({
      ip,
      reason: data.reason?.slice(0, 300) ?? "Manually blocked by an administrator",
    }),
  });
  if (error) throw new Error(error.message ?? "Could not ban that IP");
  try {
    await api.request("/member/activity-log", {
      method: "POST",
      body: JSON.stringify({ action: "login_ip_banned_manual", details: `${ip} blocked for ${hours}h by admin` }),
    });
  } catch {
    /* best-effort */
  }
  return { ok: true };
}