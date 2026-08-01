import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Anything query-ish is rejected outright — never reaches the database.
const FORBIDDEN_RE = /['"`;\\]|--|\/\*|\*\/|[<>{}$()]|\b(select|union|insert|update|delete|drop|or\s+1|and\s+1)\b/i;

export function sanitizeEmail(raw: string): { ok: boolean; email: string; error?: string } {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email) return { ok: false, email, error: "Enter your email address." };
  if (email.length > 254) return { ok: false, email, error: "That email address is too long." };
  if (FORBIDDEN_RE.test(email))
    return { ok: false, email, error: "That email address contains characters that are not allowed." };
  if (!EMAIL_RE.test(email)) return { ok: false, email, error: "Enter a valid email address." };
  return { ok: true, email };
}

/** Ban/warning state for the caller's network. Called on page load. */
export const getLoginGate = createServerFn({ method: "POST" }).handler(async () => {
  const { clientIp, getIpStatus } = await import("@/lib/login-security.server");
  return getIpStatus(clientIp());
});

/** Step 1 of the admin sign-in: is this email an admin-console account? */
export const checkAdminEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, getIpStatus, recordAttempt, isConsoleEmail } = await import(
      "@/lib/login-security.server"
    );
    const ip = clientIp();

    const gate = await getIpStatus(ip);
    if (gate.banned) return { banned: true as const, ok: false as const, status: gate };

    const clean = sanitizeEmail(data.email);
    if (!clean.ok) {
      const status = await recordAttempt({ ip, email: null, outcome: "blocked_input" });
      return { banned: status.banned, ok: false as const, error: clean.error, status };
    }

    const { exists } = await isConsoleEmail(clean.email);
    const status = await recordAttempt({
      ip,
      email: clean.email,
      outcome: exists ? "email_ok" : "email_unknown",
    });
    return {
      banned: status.banned,
      ok: exists,
      error: exists ? undefined : "This email is not recognised for admin access.",
      status,
    };
  });

/** Record the outcome of the password step (called from the client after Supabase responds). */
export const recordPasswordOutcome = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; success: boolean }) => d)
  .handler(async ({ data }) => {
    const { clientIp, recordAttempt } = await import("@/lib/login-security.server");
    const clean = sanitizeEmail(data.email);
    return recordAttempt({
      ip: clientIp(),
      email: clean.ok ? clean.email : null,
      outcome: data.success ? "success" : "bad_password",
    });
  });

/** Branded password-reset email for console accounts only. */
export const requestAdminPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; redirectTo: string }) => d)
  .handler(async ({ data }) => {
    const { clientIp, getIpStatus, recordAttempt, isConsoleEmail } = await import(
      "@/lib/login-security.server"
    );
    const ip = clientIp();
    const gate = await getIpStatus(ip);
    if (gate.banned) return { ok: false as const, banned: true as const, status: gate };

    const clean = sanitizeEmail(data.email);
    if (!clean.ok) {
      const status = await recordAttempt({ ip, email: null, outcome: "blocked_input" });
      return { ok: false as const, banned: status.banned, error: clean.error, status };
    }

    const { exists } = await isConsoleEmail(clean.email);
    if (!exists) {
      const status = await recordAttempt({ ip, email: clean.email, outcome: "reset_unknown" });
      return {
        ok: false as const,
        banned: status.banned,
        error: "This email is not recognised for admin access.",
        status,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo = data.redirectTo.startsWith("http") ? data.redirectTo : undefined;
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: clean.email,
      options: redirectTo ? { redirectTo } : undefined,
    } as any);

    if (error || !link?.properties?.action_link) {
      return { ok: false as const, banned: false as const, error: "Could not create a reset link. Try again shortly." };
    }

    const { sendTemplate } = await import("@/lib/email/send.server");
    await sendTemplate("admin_password_reset", clean.email, {
      email: clean.email,
      reset_url: link.properties.action_link,
      ip,
    });

    await recordAttempt({ ip, email: clean.email, outcome: "reset_requested" });
    return { ok: true as const, banned: false as const };
  });

/* ───────── Admin-facing management ───────── */

async function assertSecurityAdmin(supabase: any, userId: string) {
  for (const role of ["admin", "superadmin", "developer"]) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("Forbidden");
}

export const listIpBans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ip_bans" as any)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const listLoginAttempts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { page?: number; pageSize?: number; ip?: string; email?: string; outcome?: string } | undefined) =>
      d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, Math.max(5, data.pageSize ?? 25));
    let q = supabaseAdmin
      .from("login_attempts" as any)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (data.ip) q = q.ilike("ip", `%${data.ip}%`);
    if (data.email) q = q.ilike("email_tried", `%${data.email}%`);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: (rows ?? []) as any[], total: count ?? 0, page, pageSize };
  });

export const unbanIp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("ip_bans" as any)
      .select("ip")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin
      .from("ip_bans" as any)
      .update({
        unbanned_at: new Date().toISOString(),
        unbanned_by: context.userId,
        expires_at: null,
        banned_at: null,
        warning_count: 0,
        strikes: 0,
      } as any)
      .eq("id", data.id);
    if ((row as any)?.ip) {
      await supabaseAdmin
        .from("login_attempts" as any)
        .delete()
        .eq("ip", (row as any).ip)
        .in("outcome", ["email_unknown", "bad_password", "reset_unknown", "blocked_input"]);
      await supabaseAdmin.from("activity_log" as any).insert({
        user_id: context.userId,
        event_type: "login_ip_unbanned",
        detail: `${(row as any).ip} unblocked by admin`,
      } as any);
    }
    return { ok: true };
  });

export const banIpManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ip: string; hours?: number; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSecurityAdmin(context.supabase, context.userId);
    const { subnetOf } = await import("@/lib/login-security.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ip = (data.ip ?? "").trim();
    if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) throw new Error("Enter a valid IP address");
    const hours = Math.min(24 * 365, Math.max(1, data.hours ?? 24));
    const payload = {
      ip,
      subnet: subnetOf(ip),
      reason: data.reason?.slice(0, 300) ?? "Manually blocked by an administrator",
      warning_count: 3,
      banned_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
      unbanned_at: null,
      unbanned_by: null,
    };
    const { data: existing } = await supabaseAdmin
      .from("ip_bans" as any)
      .select("id")
      .eq("ip", ip)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("ip_bans" as any).update(payload as any).eq("id", (existing as any).id);
    } else {
      await supabaseAdmin.from("ip_bans" as any).insert(payload as any);
    }
    await supabaseAdmin.from("activity_log" as any).insert({
      user_id: context.userId,
      event_type: "login_ip_banned_manual",
      detail: `${ip} blocked for ${hours}h by admin`,
    } as any);
    return { ok: true };
  });
