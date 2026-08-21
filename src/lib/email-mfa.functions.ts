// @ts-nocheck
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
}

async function currentEmail(): Promise<string> {
  const { data } = await api.auth.getUser();
  const user = data?.user ?? data;
  const email = user?.email ?? user?.user?.email ?? "";
  if (!email) throw new Error("Could not find your email address");
  return email;
}

function extractCode(input: any): string {
  const data = input?.data ?? input ?? {};
  const code = String(data.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code");
  return code;
}

/** Sends a fresh 6-digit code to the signed-in user's email address. */
export async function sendEmailMfaCode(): Promise<{ sent: boolean; to: string; expires_at: string }> {
  const email = await currentEmail();
  const { data, error } = await api.request<any>("/auth/mfa/send-code", { method: "POST" });
  if (error) throw new Error(error.message ?? "Could not send the verification email");

  const body = unwrap(data) ?? {};
  const expiresInSec = typeof body.expires_in === "number" ? body.expires_in : 300;
  return {
    sent: true,
    to: maskEmail(email),
    expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

/** Verifies a code and turns email 2FA on for the signed-in user. */
export async function enableEmailMfa(input: any): Promise<{ ok: boolean }> {
  const code = extractCode(input);
  const { error } = await api.request("/auth/mfa/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (error) throw new Error(error.message ?? "Could not enable email two-factor");
  return { ok: true };
}

/** Verifies a code and turns email 2FA off for the signed-in user. */
export async function disableEmailMfa(input: any): Promise<{ ok: boolean }> {
  const code = extractCode(input);
  const { error } = await api.request("/auth/mfa/disable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (error) throw new Error(error.message ?? "Could not disable email two-factor");
  return { ok: true };
}

/** Verifies a code during sign-in (session already exists at aal1). */
export async function verifyEmailMfaChallenge(input: any): Promise<{ ok: boolean }> {
  const code = extractCode(input);
  const { data, error } = await api.request<any>("/auth/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  if (error) throw new Error(error.message ?? "Verification failed");
  const body = unwrap(data) ?? {};
  if (body.verified === false) throw new Error(body.message ?? "Verification failed");
  return { ok: true };
}

/** Whether the signed-in user has email 2FA switched on. */
export async function getEmailMfaStatus(): Promise<{ enabled: boolean; enabled_at: string | null }> {
  const { data, error } = await api.request<any>("/auth/mfa/status");
  if (error) return { enabled: false, enabled_at: null };
  const body = unwrap(data) ?? {};
  return { enabled: !!body.enabled, enabled_at: body.enabled_at ?? null };
}