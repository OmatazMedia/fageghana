import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type LogInput = {
  event_type: string;
  detail?: string | null;
};

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: LogInput) => d)
  .handler(async ({ data, context }) => {
    const ua = getRequestHeader("user-agent") ?? null;
    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      ip = null;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("activity_log" as any).insert({
      user_id: context.userId,
      event_type: data.event_type,
      detail: data.detail ?? null,
      ip_address: ip,
      user_agent: ua,
    } as any);
    return { ok: true };
  });

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

async function assertAdminOrDev(context: any) {
  const roles = ["admin", "superadmin", "developer"] as const;
  for (const r of roles) {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: r as any,
    });
    if (data) return;
  }
  throw new Error("Forbidden");
}

export const listActivityLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ListInput) => d)
  .handler(async ({ data, context }): Promise<{ rows: ActivityLogRow[]; total: number }> => {
    await assertAdminOrDev(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const page = Math.max(1, data.page ?? 1);
    const size = Math.min(200, Math.max(1, data.page_size ?? 25));

    // If filtering by role or user-search, resolve target user_ids first.
    let userIdFilter: string[] | null = null;

    if (data.role) {
      const { data: rrows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", data.role as any);
      userIdFilter = (rrows ?? []).map((r: any) => r.user_id);
      if (userIdFilter.length === 0) return { rows: [], total: 0 };
    }

    if (data.q && data.q.trim().length >= 2) {
      const term = data.q.trim();
      // Search auth users via list (up to 200 pages of 1000 would be too much — cap 500 users)
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
      const lower = term.toLowerCase();
      const matched = (list?.users ?? [])
        .filter(
          (u) =>
            (u.email ?? "").toLowerCase().includes(lower) ||
            ((u.user_metadata as any)?.full_name ?? "").toLowerCase().includes(lower),
        )
        .map((u) => u.id);
      userIdFilter = userIdFilter
        ? userIdFilter.filter((id) => matched.includes(id))
        : matched;
      if (userIdFilter.length === 0) return { rows: [], total: 0 };
    }

    if (data.user_id) {
      userIdFilter = userIdFilter
        ? userIdFilter.filter((id) => id === data.user_id)
        : [data.user_id];
      if (userIdFilter.length === 0) return { rows: [], total: 0 };
    }

    let q = supabaseAdmin
      .from("activity_log" as any)
      .select("id, user_id, event_type, detail, ip_address, user_agent, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (data.event_type) q = q.eq("event_type", data.event_type);
    if (userIdFilter) q = q.in("user_id", userIdFilter);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);

    const start = (page - 1) * size;
    q = q.range(start, start + size - 1);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    // Enrich with email + roles
    const ids = Array.from(new Set((rows ?? []).map((r: any) => r.user_id).filter(Boolean))) as string[];
    const userMap = new Map<string, { email: string | null; full_name: string | null }>();
    for (const id of ids) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        if (u?.user) {
          userMap.set(id, {
            email: u.user.email ?? null,
            full_name: ((u.user.user_metadata as any)?.full_name as string | undefined) ?? null,
          });
        }
      } catch {
        /* ignore */
      }
    }

    const { data: allRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const roleMap = new Map<string, string[]>();
    (allRoles ?? []).forEach((r: any) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role);
      roleMap.set(r.user_id, arr);
    });

    const enriched: ActivityLogRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      user_id: r.user_id,
      email: r.user_id ? userMap.get(r.user_id)?.email ?? null : null,
      full_name: r.user_id ? userMap.get(r.user_id)?.full_name ?? null : null,
      roles: r.user_id ? roleMap.get(r.user_id) ?? [] : [],
      event_type: r.event_type,
      detail: r.detail,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at,
    }));

    return { rows: enriched, total: count ?? enriched.length };
  });

export const listMyActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const limit = Math.min(100, Math.max(1, data.limit ?? 20));
    const { data: rows, error } = await context.supabase
      .from("activity_log" as any)
      .select("id, event_type, detail, ip_address, user_agent, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });
