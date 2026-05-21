// Server-only email sender. Resend (primary) with SMTP fallback (or vice versa).
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderEmail, interpolate, type Block } from "./render";

type SendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateKey?: string | null;
};

type Settings = {
  resend_api_key: string | null;
  resend_from: string | null;
  resend_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_password: string | null;
  smtp_from: string | null;
  smtp_secure: boolean;
  smtp_enabled: boolean;
  primary_provider: string;
};

async function loadSettings(): Promise<Settings | null> {
  const { data } = await supabaseAdmin.from("email_settings").select("*").limit(1).maybeSingle();
  return (data as any) ?? null;
}

async function logAttempt(row: {
  to_email: string;
  subject: string;
  template_key: string | null | undefined;
  provider: string;
  status: "sent" | "failed";
  error?: string | null;
  fallback_used: boolean;
}) {
  try {
    await supabaseAdmin.from("email_log").insert(row);
  } catch {
    /* swallow logging errors */
  }
}

async function sendViaResend(s: Settings, input: SendInput): Promise<void> {
  if (!s.resend_api_key) throw new Error("Resend API key not configured");
  if (!s.resend_from) throw new Error("Resend From address not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${s.resend_api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: s.resend_from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 240)}`);
  }
}

async function sendViaSmtp(s: Settings, input: SendInput): Promise<void> {
  if (!s.smtp_host || !s.smtp_port) throw new Error("SMTP host/port not configured");
  if (!s.smtp_from) throw new Error("SMTP From address not configured");
  const transporter = nodemailer.createTransport({
    host: s.smtp_host,
    port: s.smtp_port,
    secure: !!s.smtp_secure,
    auth: s.smtp_user && s.smtp_password ? { user: s.smtp_user, pass: s.smtp_password } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  await transporter.sendMail({
    from: s.smtp_from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

export type SendResult = { ok: boolean; provider?: "resend" | "smtp"; error?: string; fallback?: boolean };

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const s = await loadSettings();
  if (!s) {
    await logAttempt({ to_email: input.to, subject: input.subject, template_key: input.templateKey, provider: "none", status: "failed", error: "email_settings missing", fallback_used: false });
    return { ok: false, error: "Email is not configured yet" };
  }

  const order: Array<"resend" | "smtp"> = [];
  const primary = (s.primary_provider as "resend" | "smtp") || "resend";
  const other = primary === "resend" ? "smtp" : "resend";
  if (primary === "resend" && s.resend_enabled) order.push("resend");
  if (primary === "smtp" && s.smtp_enabled) order.push("smtp");
  if (other === "resend" && s.resend_enabled && !order.includes("resend")) order.push("resend");
  if (other === "smtp" && s.smtp_enabled && !order.includes("smtp")) order.push("smtp");

  if (order.length === 0) {
    await logAttempt({ to_email: input.to, subject: input.subject, template_key: input.templateKey, provider: "none", status: "failed", error: "no provider enabled", fallback_used: false });
    return { ok: false, error: "No email provider is enabled" };
  }

  let lastErr = "";
  for (let i = 0; i < order.length; i++) {
    const p = order[i];
    const fallback = i > 0;
    try {
      if (p === "resend") await sendViaResend(s, input);
      else await sendViaSmtp(s, input);
      await logAttempt({ to_email: input.to, subject: input.subject, template_key: input.templateKey, provider: p, status: "sent", error: null, fallback_used: fallback });
      return { ok: true, provider: p, fallback };
    } catch (e: any) {
      lastErr = e?.message ?? String(e);
      await logAttempt({ to_email: input.to, subject: input.subject, template_key: input.templateKey, provider: p, status: "failed", error: lastErr.slice(0, 500), fallback_used: fallback });
    }
  }
  return { ok: false, error: lastErr };
}

/** Convenience: render + send a stored template by its key. */
export async function sendTemplate(key: string, to: string, vars: Record<string, any> = {}): Promise<SendResult> {
  const { data: tpl } = await supabaseAdmin.from("email_templates").select("*").eq("key", key).maybeSingle();
  if (!tpl) return { ok: false, error: `Template "${key}" not found` };
  const subject = interpolate(tpl.subject ?? "", vars);
  const { html, text } = renderEmail((tpl.blocks ?? []) as Block[], vars);
  return sendEmail({ to, subject, html, text, templateKey: key });
}
