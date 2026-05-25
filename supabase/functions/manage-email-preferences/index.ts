// Supabase Edge Function: manage-email-preferences
// Accepts POST { user_id, newsletters, event_alerts, trade_notices, payment_reminders }
// Upserts the row in public.member_email_preferences and dispatches a
// confirmation email (using public.email_templates + public.email_settings)
// for each preference that just changed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Prefs = {
  newsletters: boolean;
  event_alerts: boolean;
  trade_notices: boolean;
  payment_reminders: boolean;
};

type PrefKey = keyof Prefs;

// Email template keys (resolved against public.email_templates.key).
// On / off variants — fall back to a generic key, then to an inline default.
const TEMPLATE_KEYS: Record<PrefKey, { on: string; off: string }> = {
  newsletters: { on: "prefs_newsletters_on", off: "prefs_newsletters_off" },
  event_alerts: { on: "prefs_event_alerts_on", off: "prefs_event_alerts_off" },
  trade_notices: { on: "prefs_trade_notices_on", off: "prefs_trade_notices_off" },
  payment_reminders: { on: "prefs_payment_reminders_on", off: "prefs_payment_reminders_off" },
};

const HUMAN: Record<PrefKey, string> = {
  newsletters: "Newsletters",
  event_alerts: "Event alerts",
  trade_notices: "Trade notices",
  payment_reminders: "Payment reminders",
};

function interpolate(s: string, vars: Record<string, string>): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function blocksToHtml(blocks: any[], vars: Record<string, string>): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => {
      const text = interpolate(String(b?.text ?? b?.content ?? ""), vars);
      switch (b?.type) {
        case "heading":
          return `<h2 style="font-family:Arial,sans-serif;color:#111">${text}</h2>`;
        case "button":
          return `<p><a href="${interpolate(String(b?.url ?? "#"), vars)}" style="display:inline-block;padding:10px 16px;background:#0a7d3b;color:#fff;text-decoration:none;border-radius:6px">${text}</a></p>`;
        default:
          return `<p style="font-family:Arial,sans-serif;color:#333;line-height:1.5">${text}</p>`;
      }
    })
    .join("\n");
}

async function sendViaResend(settings: any, to: string, subject: string, html: string) {
  if (!settings?.resend_api_key || !settings?.resend_from)
    throw new Error("Resend not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.resend_api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: settings.resend_from, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const user_id: string | undefined = body?.user_id;
    if (!user_id || typeof user_id !== "string") {
      return new Response(JSON.stringify({ success: false, error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requested: Partial<Prefs> = {};
    (Object.keys(TEMPLATE_KEYS) as PrefKey[]).forEach((k) => {
      if (typeof body?.[k] === "boolean") requested[k] = body[k];
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load existing prefs to detect changes
    const { data: existing } = await supabase
      .from("member_email_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    const merged: Prefs = {
      newsletters: requested.newsletters ?? existing?.newsletters ?? true,
      event_alerts: requested.event_alerts ?? existing?.event_alerts ?? true,
      trade_notices: requested.trade_notices ?? existing?.trade_notices ?? true,
      payment_reminders: requested.payment_reminders ?? existing?.payment_reminders ?? true,
    };

    const { data: updated, error: upsertErr } = await supabase
      .from("member_email_preferences")
      .upsert({ user_id, ...merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("*")
      .single();
    if (upsertErr) throw upsertErr;

    // Determine which prefs actually changed
    const changed: Array<{ key: PrefKey; value: boolean }> = [];
    (Object.keys(TEMPLATE_KEYS) as PrefKey[]).forEach((k) => {
      if (requested[k] === undefined) return;
      const prev = existing ? !!existing[k] : true;
      if (prev !== merged[k]) changed.push({ key: k, value: merged[k] });
    });

    // Fire confirmation emails (best-effort; failures do not fail the request)
    if (changed.length > 0) {
      const [{ data: settings }, { data: userResp }] = await Promise.all([
        supabase.from("email_settings").select("*").limit(1).maybeSingle(),
        supabase.auth.admin.getUserById(user_id),
      ]);
      const toEmail = userResp?.user?.email;

      if (toEmail && settings) {
        for (const c of changed) {
          try {
            const keys = TEMPLATE_KEYS[c.key];
            const wantedKey = c.value ? keys.on : keys.off;
            const { data: tpl } = await supabase
              .from("email_templates")
              .select("subject, blocks")
              .eq("key", wantedKey)
              .maybeSingle();

            const vars = {
              preference: HUMAN[c.key],
              state: c.value ? "enabled" : "disabled",
              email: toEmail,
            };
            const subject = tpl?.subject
              ? interpolate(tpl.subject, vars)
              : `${HUMAN[c.key]} ${c.value ? "enabled" : "disabled"}`;
            const html = tpl?.blocks
              ? blocksToHtml(tpl.blocks as any[], vars)
              : `<p style="font-family:Arial,sans-serif">Hi,</p><p style="font-family:Arial,sans-serif">This confirms that <strong>${HUMAN[c.key]}</strong> has been <strong>${c.value ? "enabled" : "disabled"}</strong> on your FAGE account.</p>`;

            await sendViaResend(settings, toEmail, subject, html);

            await supabase.from("email_log").insert({
              to_email: toEmail,
              subject,
              template_key: wantedKey,
              provider: "resend",
              status: "sent",
              fallback_used: false,
            });
          } catch (mailErr) {
            console.warn("[manage-email-preferences] email send failed:", mailErr);
            await supabase.from("email_log").insert({
              to_email: toEmail,
              subject: `Preference change: ${HUMAN[c.key]}`,
              template_key: null,
              provider: "resend",
              status: "failed",
              error: String((mailErr as Error).message ?? mailErr).slice(0, 500),
              fallback_used: false,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[manage-email-preferences] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
