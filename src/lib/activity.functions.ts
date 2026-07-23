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
    await supabaseAdmin.from("activities").insert({
      user_id: context.userId,
      event_type: data.event_type,
      title: data.event_type,
      description: data.detail ?? null,
      ip_address: ip,
      user_agent: ua,
      status: "system",
    } as any);
    return { ok: true };
  });

export const listActivityLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; event_type?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    if (!role) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("activities")
      .select("id, user_id, event_type, title, description, ip_address, user_agent, created_at")
      .not("event_type", "is", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.event_type) q = q.eq("event_type", data.event_type);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
