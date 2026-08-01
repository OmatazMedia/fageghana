// Server-only brute-force protection for the admin console entrance.
// Tracks failed attempts per IP, escalates warnings, and bans the IP plus its
// /24 subnet for 24 hours after the third warning.
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
export const ATTEMPTS_PER_WARNING = 5;
export const MAX_WARNINGS = 3;
export const BAN_MS = 24 * 60 * 60 * 1000;

export type IpStatus = {
  banned: boolean;
  bannedUntil: string | null;
  warnings: number;
  recentFailures: number;
  attemptsLeft: number;
  message: string | null;
};

export function clientIp(): string {
  try {
    return (
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export function userAgent(): string | null {
  try {
    return getRequestHeader("user-agent") ?? null;
  } catch {
    return null;
  }
}

/** IPv4 /24 or IPv6 /48 — the blast radius of a ban. */
export function subnetOf(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + "::/48";
  const p = ip.split(".");
  if (p.length !== 4) return ip;
  return `${p[0]}.${p[1]}.${p[2]}.0/24`;
}

function warningMessage(warnings: number, attemptsLeft: number): string | null {
  if (warnings <= 0) return null;
  if (warnings >= MAX_WARNINGS) return "This network has been blocked for 24 hours.";
  const remaining = MAX_WARNINGS - warnings;
  return `Warning ${warnings} of ${MAX_WARNINGS}: too many failed attempts. ${remaining} more warning${
    remaining === 1 ? "" : "s"
  } and this network will be blocked for 24 hours. ${attemptsLeft} attempt${
    attemptsLeft === 1 ? "" : "s"
  } left before the next warning.`;
}

async function activeBan(ip: string) {
  const subnet = subnetOf(ip);
  const { data } = await supabaseAdmin
    .from("ip_bans" as any)
    .select("*")
    .or(`ip.eq.${ip},subnet.eq.${subnet}`)
    .is("unbanned_at", null)
    .not("expires_at", "is", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  return Array.isArray(data) && data.length ? (data[0] as any) : null;
}

async function banRow(ip: string) {
  const { data } = await supabaseAdmin
    .from("ip_bans" as any)
    .select("*")
    .eq("ip", ip)
    .maybeSingle();
  return (data as any) ?? null;
}

async function recentFailureCount(ip: string): Promise<number> {
  const since = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from("login_attempts" as any)
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since)
    .in("outcome", ["email_unknown", "bad_password", "reset_unknown", "blocked_input"]);
  return count ?? 0;
}

export async function getIpStatus(ip: string): Promise<IpStatus> {
  const ban = await activeBan(ip);
  if (ban) {
    return {
      banned: true,
      bannedUntil: ban.expires_at,
      warnings: ban.warning_count ?? MAX_WARNINGS,
      recentFailures: 0,
      attemptsLeft: 0,
      message: "This network has been blocked because of repeated failed sign-in attempts.",
    };
  }
  const failures = await recentFailureCount(ip);
  const warnings = Math.min(MAX_WARNINGS - 1, Math.floor(failures / ATTEMPTS_PER_WARNING));
  const attemptsLeft = Math.max(0, ATTEMPTS_PER_WARNING - (failures % ATTEMPTS_PER_WARNING));
  return {
    banned: false,
    bannedUntil: null,
    warnings,
    recentFailures: failures,
    attemptsLeft,
    message: warningMessage(warnings, attemptsLeft),
  };
}

async function log(event_type: string, detail: string, ip: string) {
  try {
    await supabaseAdmin.from("activity_log" as any).insert({
      user_id: null,
      event_type,
      detail,
      ip_address: ip === "unknown" ? null : ip,
      user_agent: userAgent(),
    } as any);
  } catch {
    /* best-effort */
  }
}

export type Outcome =
  | "email_unknown"
  | "email_ok"
  | "bad_password"
  | "success"
  | "reset_requested"
  | "reset_unknown"
  | "blocked_input";

/** Record an attempt and return the caller's resulting status. */
export async function recordAttempt(input: {
  ip: string;
  email?: string | null;
  outcome: Outcome;
  portal?: string;
}): Promise<IpStatus> {
  const ip = input.ip;
  const subnet = subnetOf(ip);

  try {
    await supabaseAdmin.from("login_attempts" as any).insert({
      ip,
      subnet,
      email_tried: input.email ? input.email.slice(0, 254) : null,
      outcome: input.outcome,
      portal: input.portal ?? "admin",
      user_agent: userAgent(),
    } as any);
  } catch {
    /* never block sign-in on logging failure */
  }

  // A successful sign-in wipes the slate for this IP.
  if (input.outcome === "success") {
    try {
      await supabaseAdmin
        .from("login_attempts" as any)
        .delete()
        .eq("ip", ip)
        .in("outcome", ["email_unknown", "bad_password", "reset_unknown", "blocked_input"]);
      const row = await banRow(ip);
      if (row && !row.expires_at) {
        await supabaseAdmin
          .from("ip_bans" as any)
          .update({ warning_count: 0, strikes: 0 })
          .eq("id", row.id);
      }
    } catch {
      /* noop */
    }
    return {
      banned: false,
      bannedUntil: null,
      warnings: 0,
      recentFailures: 0,
      attemptsLeft: ATTEMPTS_PER_WARNING,
      message: null,
    };
  }

  if (input.outcome === "email_ok" || input.outcome === "reset_requested") {
    return getIpStatus(ip);
  }

  const failures = await recentFailureCount(ip);
  const warnings = Math.min(MAX_WARNINGS, Math.floor(failures / ATTEMPTS_PER_WARNING));
  const attemptsLeft = Math.max(0, ATTEMPTS_PER_WARNING - (failures % ATTEMPTS_PER_WARNING));

  if (warnings <= 0) {
    return {
      banned: false,
      bannedUntil: null,
      warnings: 0,
      recentFailures: failures,
      attemptsLeft,
      message: null,
    };
  }

  const existing = await banRow(ip);
  const shouldBan = warnings >= MAX_WARNINGS;
  const expiresAt = shouldBan ? new Date(Date.now() + BAN_MS).toISOString() : null;

  const payload: Record<string, unknown> = {
    ip,
    subnet,
    warning_count: warnings,
    strikes: failures,
    last_email_tried: input.email ? input.email.slice(0, 254) : existing?.last_email_tried ?? null,
    reason: shouldBan ? "Automatic: repeated failed admin sign-in attempts" : "Warnings issued",
  };
  if (shouldBan) {
    payload.banned_at = new Date().toISOString();
    payload.expires_at = expiresAt;
    payload.unbanned_at = null;
    payload.unbanned_by = null;
  }

  try {
    if (existing) {
      await supabaseAdmin.from("ip_bans" as any).update(payload as any).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("ip_bans" as any).insert(payload as any);
    }
  } catch {
    /* noop */
  }

  if (shouldBan && (!existing || existing.warning_count ?? 0) < MAX_WARNINGS) {
    await log("login_ip_banned", `${ip} (${subnet}) blocked for 24h after ${failures} failed attempts`, ip);
    try {
      await supabaseAdmin.from("notifications" as any).insert({
        user_id: null,
        title: "Admin login blocked",
        body: `${ip} (${subnet}) was blocked for 24 hours after ${failures} failed admin sign-in attempts.`,
        link: "/admin/login-security",
      } as any);
    } catch {
      /* noop */
    }
  } else if (!existing || (existing.warning_count ?? 0) < warnings) {
    await log("login_ip_warning", `${ip} (${subnet}) warning ${warnings}/${MAX_WARNINGS}`, ip);
  }

  return {
    banned: shouldBan,
    bannedUntil: expiresAt,
    warnings,
    recentFailures: failures,
    attemptsLeft: shouldBan ? 0 : attemptsLeft,
    message: warningMessage(warnings, attemptsLeft),
  };
}

/** Does this email belong to an account with an admin-console role? */
export async function isConsoleEmail(email: string): Promise<{ exists: boolean; userId: string | null }> {
  const { data, error } = await supabaseAdmin.rpc("console_account_for_email" as any, {
    _email: email,
  } as any);
  if (error) return { exists: false, userId: null };
  const row = Array.isArray(data) ? (data[0] as any) : (data as any);
  if (!row) return { exists: false, userId: null };
  return { exists: !!row.exists_console, userId: (row.user_id as string) ?? null };
}
