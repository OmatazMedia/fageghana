// @ts-nocheck
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

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

/** Create or refresh the session row for the current device. */
export async function registerSession(input: any) {
  const data = input?.data ?? input ?? {};
  const payload = {
    session_fingerprint: data.fingerprint,
    browser: data.browser ?? null,
    os: data.os ?? null,
    device_label: data.deviceLabel ?? null,
  };
  const { data: res, error } = await api.request<any>("/member/sessions/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (error) throw new Error(error.message ?? "Could not register this device");

  const body = unwrap(res) ?? {};
  const session = body.session ?? body;
  const isNewDevice = body.is_new_device ?? body.isNewDevice ?? false;
  return {
    sessionId: session?.id ?? null,
    isNewDevice: !!isNewDevice,
  };
}

/** Keep-alive + revocation/anomaly check. Called every couple of minutes. */
export async function heartbeatSession(input: any) {
  const data = input?.data ?? input ?? {};
  const { data: res, error } = await api.request<any>("/member/sessions/heartbeat", {
    method: "POST",
    body: JSON.stringify({ session_fingerprint: data.fingerprint }),
  });
  if (error) {
    // Transient network errors must not sign the user out; caller ignores rejects.
    return { valid: true, reason: null };
  }
  const body = unwrap(res) ?? {};
  if (body.valid === false) return { valid: false, reason: body.reason ?? "revoked" };
  return { valid: true, reason: null };
}

/** Sessions for the signed-in user (or for another user, if caller is admin). */
export async function listSessions(input: any): Promise<SessionRow[]> {
  const data = input?.data ?? input ?? {};
  const qs = data.userId ? `?user_id=${encodeURIComponent(data.userId)}` : "";
  const { data: res, error } = await api.request<any>(`/member/sessions${qs}`);
  if (error) throw new Error(error.message ?? "Failed to load sessions");
  const body = unwrap(res) ?? {};
  const rows = Array.isArray(body) ? body : body.sessions ?? body.data ?? [];
  return (Array.isArray(rows) ? rows : []) as SessionRow[];
}

export async function revokeSession(input: any) {
  const data = input?.data ?? input ?? {};
  const { error } = await api.request(`/member/sessions/${encodeURIComponent(data.sessionId)}/revoke`, {
    method: "POST",
    body: JSON.stringify({ reason: data.reason ?? "manual" }),
  });
  if (error) throw new Error(error.message ?? "Could not sign out that device");
  return { ok: true };
}

export async function revokeOtherSessions(input: any) {
  const data = input?.data ?? input ?? {};
  const { data: res, error } = await api.request<any>("/member/sessions/revoke-others", {
    method: "POST",
    body: JSON.stringify({ session_fingerprint: data.keepFingerprint }),
  });
  if (error) throw new Error(error.message ?? "Could not sign out the other devices");
  const body = unwrap(res) ?? {};
  return { revoked: typeof body.revoked === "number" ? body.revoked : 0 };
}