import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SessionRow = {
  id: string;
  user_id: string;
  session_fingerprint: string;
  device_label: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  suspicious: boolean;
};

function clientIp(): string | null {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? getRequestHeader("cf-connecting-ip") ?? null;
  } catch {
    return null;
  }
}

/** Coarse network comparison: IPv4 /16 or IPv6 /32. Avoids false alarms from
 *  ordinary carrier IP rotation while still catching a different network. */
function sameNetwork(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.includes(":") && b.includes(":")) {
    return a.split(":").slice(0, 2).join(":") === b.split(":").slice(0, 2).join(":");
  }
  const pa = a.split(".");
  const pb = b.split(".");
  if (pa.length !== 4 || pb.length !== 4) return false;
  return pa[0] === pb[0] && pa[1] === pb[1];
}

/** Create or refresh the session row for the current device. */
export const registerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { fingerprint: string; deviceLabel: string; browser: string; os: string; origin?: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const ip = clientIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_sessions" as any)
      .select("id")
      .eq("user_id", context.userId)
      .eq("session_fingerprint", data.fingerprint)
      .is("revoked_at", null)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("user_sessions" as any)
        .update({ last_seen_at: new Date().toISOString(), ip_address: ip })
        .eq("id", (existing as any).id);
      return { sessionId: (existing as any).id as string, isNewDevice: false };
    }

    const { data: seen } = await supabaseAdmin
      .from("user_sessions" as any)
      .select("id")
      .eq("user_id", context.userId)
      .eq("session_fingerprint", data.fingerprint)
      .limit(1);
    const knownDevice = Array.isArray(seen) && seen.length > 0;

    const { data: created } = await supabaseAdmin
      .from("user_sessions" as any)
      .insert({
        user_id: context.userId,
        session_fingerprint: data.fingerprint,
        device_label: data.deviceLabel,
        browser: data.browser,
        os: data.os,
        ip_address: ip,
      } as any)
      .select("id")
      .single();

    if (!knownDevice) {
      await supabaseAdmin.from("activity_log" as any).insert({
        user_id: context.userId,
        event_type: "new_device_sign_in",
        detail: `${data.deviceLabel}${ip ? ` · ${ip}` : ""}`,
        ip_address: ip,
        user_agent: getRequestHeader("user-agent") ?? null,
      } as any);

      // Branded "new sign-in" alert — only for devices we haven't seen before.
      const email = (context.claims as any)?.email as string | undefined;
      if (email) {
        try {
          const { describeLocation } = await import("@/lib/login-alert.server");
          const { sendTemplate } = await import("@/lib/email/send.server");
          const when = new Intl.DateTimeFormat("en-GB", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "Africa/Accra",
          }).format(new Date());
          await sendTemplate("login_alert", email, {
            email,
            device: data.deviceLabel,
            browser: data.browser,
            os: data.os,
            ip: ip ?? "unknown",
            location: await describeLocation(ip),
            time: `${when} (Accra)`,
            reset_url: `${data.origin ?? "https://fageghana.lovable.app"}/reset-password?from=login_alert`,
          });
        } catch {
          /* alert emails must never block sign-in */
        }
      }
    }


    return { sessionId: (created as any)?.id as string, isNewDevice: !knownDevice };
  });

/** Keep-alive + revocation/anomaly check. Called every couple of minutes. */
export const heartbeatSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string; fingerprint: string }) => d)
  .handler(async ({ data, context }) => {
    const ip = clientIp();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("user_sessions" as any)
      .select("id, user_id, session_fingerprint, ip_address, revoked_at, revoked_reason")
      .eq("id", data.sessionId)
      .maybeSingle();

    if (!row) return { valid: false, reason: "unknown_session" as const };
    if ((row as any).user_id !== context.userId) {
      return { valid: false, reason: "mismatched_user" as const };
    }
    if ((row as any).revoked_at) {
      return { valid: false, reason: ((row as any).revoked_reason ?? "revoked") as string };
    }

    const fpChanged = (row as any).session_fingerprint !== data.fingerprint;
    const ipChanged = !sameNetwork((row as any).ip_address, ip);

    if (fpChanged || ipChanged) {
      const reason = fpChanged ? "fingerprint_changed" : "network_changed";
      await supabaseAdmin
        .from("user_sessions" as any)
        .update({ revoked_at: new Date().toISOString(), revoked_reason: reason, suspicious: true })
        .eq("id", data.sessionId);
      await supabaseAdmin.from("activity_log" as any).insert({
        user_id: context.userId,
        event_type: "session_anomaly",
        detail: `${reason}${ip ? ` · new IP ${ip}` : ""}`,
        ip_address: ip,
        user_agent: getRequestHeader("user-agent") ?? null,
      } as any);
      return { valid: false, reason };
    }

    await supabaseAdmin
      .from("user_sessions" as any)
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.sessionId);

    return { valid: true, reason: null };
  });

/** Sessions for the signed-in user (or for another user, if caller is admin). */
export const listSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const target = data.userId ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("user_sessions" as any)
      .select("*")
      .eq("user_id", target)
      .order("last_seen_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as SessionRow[];
  });

export const revokeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessionId: string; reason?: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_user_session" as any, {
      _id: data.sessionId,
      _reason: data.reason ?? "manual",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { keepFingerprint: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc(
      "revoke_my_other_sessions" as any,
      { _keep_fingerprint: data.keepFingerprint } as any,
    );
    if (error) throw new Error(error.message);
    return { revoked: (count as unknown as number) ?? 0 };
  });
