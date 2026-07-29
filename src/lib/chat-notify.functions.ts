// Server function: notify configured admins when a chatbot "Leave a message" arrives.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional().nullable(),
  message: z.string().min(1).max(5000),
  contact_message_id: z.string().uuid().optional().nullable(),
});

export const notifyChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { sendEmail } = await import("@/lib/email/send.server");
      const { emailTheme: t } = await import("@/lib/email/theme");

      const { data: settings } = await supabaseAdmin
        .from("admin_notification_settings")
        .select("chat_message_recipients")
        .eq("id", 1)
        .maybeSingle();

      const recipients = (settings?.chat_message_recipients ?? []) as string[];
      if (!recipients.length) return { ok: true, sent: 0 };

      const safe = (s: string) =>
        String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

      const site = t.siteUrl ?? "";
      const replyUrl = `${site}/admin/tickets?tab=chat`;
      const subject = `New chatbot message from ${data.name}`;
      const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${safe(subject)}</title></head>
<body style="margin:0;padding:0;background:${t.background};font-family:${t.fontFamily};color:${t.text};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.background};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${t.card};border:1px solid ${t.border};border-radius:14px;overflow:hidden;">
      <tr><td style="background:${t.primary};padding:20px 24px;text-align:center;">
        <img src="${t.logoUrl}" alt="${safe(t.orgShort)}" style="height:38px;width:auto;display:inline-block;"/>
        <div style="color:#fff;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin-top:6px;">Chatbot · Leave a message</div>
      </td></tr>
      <tr><td style="padding:24px;">
        <h1 style="margin:0 0 6px 0;font-size:20px;color:${t.text};">New message from ${safe(data.name)}</h1>
        <p style="margin:0 0 18px 0;font-size:13px;color:${t.muted};">Submitted through the website chatbot.</p>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr><td style="padding:6px 0;color:${t.muted};width:90px;">Name</td><td style="padding:6px 0;font-weight:600;">${safe(data.name)}</td></tr>
          <tr><td style="padding:6px 0;color:${t.muted};">Email</td><td style="padding:6px 0;"><a href="mailto:${safe(data.email)}" style="color:${t.primary};text-decoration:none;">${safe(data.email)}</a></td></tr>
          ${data.phone ? `<tr><td style="padding:6px 0;color:${t.muted};">Phone</td><td style="padding:6px 0;"><a href="tel:${safe(data.phone)}" style="color:${t.primary};text-decoration:none;">${safe(data.phone)}</a></td></tr>` : ""}
        </table>

        <div style="margin-top:18px;padding:14px 16px;background:${t.background};border:1px solid ${t.border};border-radius:10px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:${t.muted};margin-bottom:6px;">Message</div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.55;color:${t.text};">${safe(data.message)}</div>
        </div>

        <div style="text-align:center;margin-top:24px;">
          <a href="${replyUrl}" style="display:inline-block;background:${t.primary};color:#fff;text-decoration:none;padding:12px 26px;border-radius:9999px;font-weight:600;font-size:14px;">Open in admin dashboard</a>
        </div>
      </td></tr>
      <tr><td style="padding:16px 24px;background:${t.background};border-top:1px solid ${t.border};text-align:center;font-size:12px;color:${t.muted};">
        ${safe(t.orgName)}<br/>${safe(t.footerAddress)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

      const text = `New chatbot message from ${data.name}
Email: ${data.email}${data.phone ? `\nPhone: ${data.phone}` : ""}

${data.message}

Open in admin: ${replyUrl}`;

      let sent = 0;
      for (const to of recipients) {
        const r = await sendEmail({ to, subject, html, text, templateKey: "chatbot_message" });
        if (r.ok) sent++;
      }
      return { ok: true, sent };
    } catch (e: any) {
      // Never break the user flow on email failures.
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
