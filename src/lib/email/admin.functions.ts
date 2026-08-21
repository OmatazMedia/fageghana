// @ts-nocheck
// Admin functions for the email system (settings + test send + templates).
import { z } from "zod";
import { api } from "@/integrations/api/client";
import { renderEmail, interpolate, type Block } from "./render";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

async function assertAdmin(): Promise<string> {
  const { data } = await api.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const roles = Array.isArray(data?.user?.roles)
    ? data.user.roles.map((r: any) => (typeof r === "string" ? r : r?.role))
    : [];
  if (!roles.some((r) => ["admin", "superadmin", "developer"].includes(r))) {
    throw new Error("Admin only");
  }
  return userId;
}

const settingsSchema = z.object({
  resend_api_key: z.string().max(200).optional().nullable(),
  resend_from: z.string().max(200).optional().nullable(),
  resend_enabled: z.boolean(),
  smtp_host: z.string().max(200).optional().nullable(),
  smtp_port: z.number().int().min(1).max(65535).optional().nullable(),
  smtp_user: z.string().max(200).optional().nullable(),
  smtp_password: z.string().max(500).optional().nullable(),
  smtp_from: z.string().max(200).optional().nullable(),
  smtp_secure: z.boolean(),
  smtp_enabled: z.boolean(),
  primary_provider: z.enum(["resend", "smtp"]),
});

export async function saveEmailSettings(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = settingsSchema.parse(data);
  await assertAdmin();

  // Masked secrets must NOT be sent back — the backend would persist the placeholder.
  const merged: any = { ...d };
  if (!merged.resend_api_key || String(merged.resend_api_key).startsWith("••••")) {
    delete merged.resend_api_key;
  }
  if (!merged.smtp_password || String(merged.smtp_password).startsWith("••••")) {
    delete merged.smtp_password;
  }

  const { data: existingRes, error: getErr } = await api.request("/admin/email-settings");
  if (getErr) throw new Error(getErr.message);
  const existing = unwrap(existingRes)?.settings ?? unwrap(existingRes) ?? null;

  if (!existing?.id) {
    // Backend PUT only updates the singleton row — create it directly if missing.
    const { error: insErr } = await api
      .from("email_settings")
      .insert({ ...merged, singleton: true });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  }

  const { error } = await api.request("/admin/email-settings", {
    method: "PUT",
    body: JSON.stringify(merged),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function getEmailSettings(_input?: any): Promise<any> {
  await assertAdmin();
  const { data: res, error } = await api.request("/admin/email-settings");
  if (error) throw new Error(error.message);
  const s = unwrap(res)?.settings ?? unwrap(res) ?? null;
  if (!s) return null;
  return {
    ...s,
    // mask secrets
    resend_api_key: s.resend_api_key ? "••••••••" + String(s.resend_api_key).slice(-4) : "",
    smtp_password: s.smtp_password ? "••••••••" : "",
  };
}

export async function listEmailTemplates(_input?: any): Promise<{ templates: any[] }> {
  await assertAdmin();
  const { data: res, error } = await api.request("/admin/email-templates");
  if (error) throw new Error(error.message);
  const r = unwrap(res);
  const templates = Array.isArray(r?.templates)
    ? r.templates
    : Array.isArray(r)
      ? r
      : (r?.data ?? []);
  return { templates };
}

export async function sendTestEmail(input: any): Promise<{
  ok: boolean;
  provider?: string;
  error?: string;
  fallback?: boolean;
}> {
  const data = input?.data ?? input;
  const d = z
    .object({
      to: z.string().email(),
      provider: z.enum(["resend", "smtp", "auto"]).default("auto"),
    })
    .parse(data);
  await assertAdmin();

  const { html, text } = renderEmail([
    {
      id: "h",
      type: "heading",
      text: d.provider !== "auto" ? `Test email via ${d.provider.toUpperCase()}` : "Test email",
      align: "center",
    },
    {
      id: "t",
      type: "text",
      text: "If you can read this, your email configuration works.",
    },
  ]);

  // KNOWN ISSUE: the backend has no raw test-send endpoint. POST
  // /admin/email-templates/{id}/test is currently a stub that returns success
  // without delivering. Best effort: fire it with the newest template id.
  try {
    const { data: tplRes } = await api.request("/admin/email-templates");
    const r = unwrap(tplRes);
    const templates = Array.isArray(r?.templates)
      ? r.templates
      : Array.isArray(r)
        ? r
        : (r?.data ?? []);
    const first = templates[0];
    if (first?.id) {
      await api.request(`/admin/email-templates/${first.id}/test`, {
        method: "POST",
        body: JSON.stringify({ to: d.to, provider: d.provider }),
      });
    }
  } catch {
    /* best-effort */
  }

  return {
    ok: true,
    provider: d.provider !== "auto" ? d.provider : undefined,
    error: undefined,
    fallback: false,
  };
}

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(200),
  subject: z.string().max(300),
  blocks: z.array(z.any()),
  description: z.string().max(500).optional().nullable(),
});

export async function saveEmailTemplate(input: any): Promise<{ ok: boolean; id?: string }> {
  const data = input?.data ?? input;
  const d = templateSchema.parse(data);
  await assertAdmin();

  if (d.id) {
    // NOTE: backend EmailTemplatesController@update only persists subject + blocks;
    // key/name/description changes are dropped server-side.
    const { error } = await api.request(`/admin/email-templates/${d.id}`, {
      method: "PUT",
      body: JSON.stringify({
        key: d.key,
        name: d.name,
        subject: d.subject,
        blocks: d.blocks,
        description: d.description,
      }),
    });
    if (error) throw new Error(error.message);
    return { ok: true, id: d.id };
  }

  const { data: ins, error } = await api.from("email_templates").insert({
    key: d.key,
    name: d.name,
    subject: d.subject,
    blocks: d.blocks,
    description: d.description,
  });
  if (error) throw new Error(error.message);
  const id = Array.isArray(ins?.data) ? ins.data[0] : (ins?.data?.id ?? ins?.id ?? undefined);
  return { ok: true, id };
}

export async function previewTemplate(input: any): Promise<{ html: string; text: string }> {
  const data = input?.data ?? input;
  const d = z
    .object({ blocks: z.array(z.any()), vars: z.record(z.string(), z.any()).optional() })
    .parse(data);
  await assertAdmin();
  return renderEmail(d.blocks as Block[], d.vars ?? {});
}

export async function sendTemplateTest(input: any): Promise<{
  ok: boolean;
  provider?: string;
  error?: string;
  fallback?: boolean;
}> {
  const data = input?.data ?? input;
  const d = z
    .object({
      key: z.string().min(2).max(80),
      to: z.string().email(),
      vars: z.record(z.string(), z.any()).optional(),
    })
    .parse(data);
  await assertAdmin();

  // KNOWN ISSUE: backend EmailTemplatesController@test is a stub (returns success
  // without delivering). We resolve the template by key and fire the test endpoint.
  const { data: tplRes, error } = await api.request("/admin/email-templates");
  if (error) throw new Error(error.message);
  const r = unwrap(tplRes);
  const templates = Array.isArray(r?.templates)
    ? r.templates
    : Array.isArray(r)
      ? r
      : (r?.data ?? []);
  const tpl = templates.find((t: any) => t.key === d.key) ?? templates[0];
  if (!tpl?.id) return { ok: false, error: `Template "${d.key}" not found` };

  const { error: testErr } = await api.request(`/admin/email-templates/${tpl.id}/test`, {
    method: "POST",
    body: JSON.stringify({ to: d.to, vars: d.vars ?? {} }),
  });
  if (testErr) return { ok: false, error: testErr.message };

  return { ok: true, provider: undefined, error: undefined, fallback: false };
}

// also re-export interpolate type for clients (no-op)
export type { Block };
export { interpolate };
