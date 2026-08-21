// @ts-nocheck
import { api } from "@/integrations/api/client";

type LogInput = {
  event_type: string;
  detail?: string | null;
};

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

/** Best-effort activity log for the signed-in user (never blocks the caller). */
export async function logActivity(input: any): Promise<{ ok: boolean }> {
  const data: LogInput = input?.data ?? input ?? {};
  try {
    await api.request("/member/activity-log", {
      method: "POST",
      body: JSON.stringify({ action: data.event_type, details: data.detail ?? null }),
    });
  } catch {
    /* best-effort */
  }
  return { ok: true };
}

export type ActivityLogRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  roles: string[];
  event_type: string;
  detail: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

type ListInput = {
  page?: number;
  page_size?: number;
  event_type?: string | null;
  user_id?: string | null;
  role?: string | null;
  q?: string | null;
  from?: string | null;
  to?: string | null;
};

async function requireAdminOrDev() {
  const { data } = await api.auth.getUser();
  const roles: string[] = Array.isArray(data?.user?.roles)
    ? data.user.roles.map((r: any) => (typeof r === "string" ? r : r?.role ?? ""))
    : [];
  if (!["admin", "superadmin", "developer"].some((r) => roles.includes(r))) {
    throw new Error("Forbidden");
  }
}

export async function listActivityLog(input: any): Promise<{ rows: ActivityLogRow[]; total: number }> {
  await requireAdminOrDev();
  const data: ListInput = input?.data ?? input ?? {};
  const page = Math.max(1, data.page ?? 1);
  const size = Math.min(200, Math.max(1, data.page_size ?? 25));

  const params = new URLSearchParams();
  params.set("page", String(page));
  const raw = await api.request<any>(`/admin/activity-log?${params.toString()}`);
  if (raw.error) throw new Error(raw.error.message ?? "Failed to load activity log");

  const payload = unwrap(raw) ?? {};
  const rowsRaw: any[] = Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
  const total = typeof payload.total === "number" ? payload.total : rowsRaw.length;

  const ids = Array.from(new Set(rowsRaw.map((r: any) => r.user_id).filter(Boolean))) as string[];

  let roleMap = new Map<string, string[]>();
  let nameMap = new Map<string, { email: string | null; full_name: string | null }>();
  if (ids.length) {
    try {
      const rolesRaw = await api.from("user_roles").select("user_id, role").in("user_id", ids);
      const roleRows = Array.isArray(rolesRaw?.data) ? rolesRaw.data : [];
      roleRows.forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
    } catch {
      /* best-effort enrichment */
    }
    try {
      for (const id of ids) {
        const u = await api.request<any>(`/admin/users/${id}`);
        if (!u.error) {
          const user = unwrap(u)?.user ?? unwrap(u);
          if (user) {
            nameMap.set(id, {
              email: user.email ?? null,
              full_name: user.name ?? user.full_name ?? null,
            });
          }
        }
      }
    } catch {
      /* best-effort enrichment */
    }
  }

  const rows: ActivityLogRow[] = rowsRaw.map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    email: r.user_id ? nameMap.get(r.user_id)?.email ?? null : null,
    full_name: r.user_id ? nameMap.get(r.user_id)?.full_name ?? null : null,
    roles: r.user_id ? roleMap.get(r.user_id) ?? [] : [],
    event_type: r.event_type,
    detail: r.detail,
    ip_address: r.ip_address,
    user_agent: r.user_agent,
    created_at: r.created_at,
  }));

  return { rows, total };
}

export async function listMyActivity(input: any): Promise<any[]> {
  const data = input?.data ?? input ?? {};
  const limit = Math.min(100, Math.max(1, data.limit ?? 20));
  const { data: rows, error } = await api.request<any>(`/member/activity-log?limit=${limit}`);
  if (error) throw new Error(error.message ?? "Failed to load activity");
  const list = unwrap(rows);
  return Array.isArray(list) ? list : [];
}