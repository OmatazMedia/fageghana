// Admin server functions for the email system (settings + test send + templates).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, sendTemplate } from "./send.server";
import { renderEmail, interpolate, type Block } from "./render";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Admin only");
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

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: existing } = await supabaseAdmin.from("email_settings").select("id, resend_api_key, smtp_password").limit(1).maybeSingle();
    // If a secret field is sent empty, keep the existing one
    const merged: any = { ...data };
    if (!merged.resend_api_key && existing?.resend_api_key) merged.resend_api_key = existing.resend_api_key;
    if (!merged.smtp_password && existing?.smtp_password) merged.smtp_password = existing.smtp_password;
    if (existing?.id) {
      const { error } = await supabaseAdmin.from("email_settings").update(merged).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("email_settings").insert({ ...merged, singleton: true });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const getEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("email_settings").select("*").limit(1).maybeSingle();
    if (!data) return null;
    return {
      ...data,
      // mask secrets
      resend_api_key: data.resend_api_key ? "••••••••" + (data.resend_api_key as string).slice(-4) : "",
      smtp_password: data.smtp_password ? "••••••••" : "",
    };
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ to: z.string().email(), provider: z.enum(["resend", "smtp", "auto"]).default("auto") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Force-temp-override the primary provider if requested
    if (data.provider !== "auto") {
      const { data: s } = await supabaseAdmin.from("email_settings").select("*").limit(1).maybeSingle();
      if (s) {
        // temporarily disable the other for this call
        const other = data.provider === "resend" ? "smtp" : "resend";
        const otherKey = other === "resend" ? "resend_enabled" : "smtp_enabled";
        const wasOtherEnabled = (s as any)[otherKey];
        await supabaseAdmin.from("email_settings").update({ primary_provider: data.provider, [otherKey]: false } as any).eq("id", s.id);
        try {
          const { html, text } = renderEmail([
            { id: "h", type: "heading", text: `Test email via ${data.provider.toUpperCase()}`, align: "center" },
            { id: "t", type: "text", text: "If you can read this, your email configuration works." },
          ]);
          const result = await sendEmail({ to: data.to, subject: "FAGE test email", html, text });
          return result;
        } finally {
          await supabaseAdmin.from("email_settings").update({ [otherKey]: wasOtherEnabled } as any).eq("id", s.id);
        }
      }
    }
    const { html, text } = renderEmail([
      { id: "h", type: "heading", text: "Test email", align: "center" },
      { id: "t", type: "text", text: "If you can read this, your email configuration works." },
    ]);
    return sendEmail({ to: data.to, subject: "FAGE test email", html, text });
  });

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().min(2).max(80).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(200),
  subject: z.string().max(300),
  blocks: z.array(z.any()),
  description: z.string().max(500).optional().nullable(),
});

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("email_templates").update({
        key: data.key, name: data.name, subject: data.subject, blocks: data.blocks, description: data.description,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin.from("email_templates").insert({
      key: data.key, name: data.name, subject: data.subject, blocks: data.blocks, description: data.description,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id };
  });

export const previewTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ blocks: z.array(z.any()), vars: z.record(z.string(), z.any()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return renderEmail(data.blocks as Block[], data.vars ?? {});
  });

export const sendTemplateTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(2).max(80), to: z.string().email(), vars: z.record(z.string(), z.any()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return sendTemplate(data.key, data.to, data.vars ?? {});
  });

// also re-export interpolate type for clients (no-op)
export type { Block };
export { interpolate };
