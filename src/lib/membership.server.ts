// Server-only helpers for membership lifecycle.
// Not a *.functions.ts file — only imported by server fns and server routes.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplate } from "@/lib/email/send.server";

type Tier = "associate" | "standard" | "corporate";

function deterministicPassword(fullName: string, phone: string): string {
  const firstRaw = (fullName || "").trim().split(/\s+/)[0] || "Member";
  const cleaned = firstRaw.replace(/[^A-Za-z0-9]/g, "") || "Member";
  const first = cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
  const digits = (phone || "").replace(/\D/g, "");
  const last2 = digits.length >= 2 ? digits.slice(-2) : (digits + "00").slice(0, 2);
  return `${first}@${last2}`;
}

function siteOriginFromEnv(): string {
  const base = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || "https://fageghana.lovable.app";
  return base.replace(/\/+$/, "");
}

async function ensureUserForEmail(email: string, fullName: string, phone: string): Promise<{ userId: string; created: boolean; tempPassword?: string }> {
  // Try to find existing user by paginating admin.listUsers
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (match) return { userId: match.id, created: false };
    if (data.users.length < 200) break;
    page += 1;
    if (page > 25) break; // safety
  }
  const tempPassword = deterministicPassword(fullName, phone);
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  });
  if (createErr || !created.user) throw new Error(`createUser failed: ${createErr?.message ?? "unknown"}`);
  return { userId: created.user.id, created: true, tempPassword };
}

async function generateLoginLink(email: string, claimToken?: string): Promise<string | null> {
  const redirectPath = claimToken ? `/apply/claim?token=${claimToken}` : `/dashboard`;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${siteOriginFromEnv()}${redirectPath}` },
  });
  if (error) return null;
  return data?.properties?.action_link ?? null;
}

/**
 * Called when a payment_submissions row flips to 'confirmed'.
 * Idempotent — safe to call from both verifyPayment and webhooks.
 */
export async function finalizePaymentConfirmation(submissionId: string): Promise<void> {
  const { data: sub, error } = await supabaseAdmin
    .from("payment_submissions")
    .select("*")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !sub) throw new Error(`Submission ${submissionId} not found`);
  if (sub.status !== "confirmed") return; // only act on confirmed rows

  // Determine tier + plan
  const message: string = sub.member_message ?? "";
  const tierMatch = /tier:([a-z0-9_-]+)/i.exec(message);
  const tier = (tierMatch?.[1] as Tier) || null;
  const isRenew = sub.kind === "renew";

  let userId = sub.user_id as string | null;

  // ── New application path: ensure user from pending_applications
  if (!isRenew && sub.pending_application_id) {
    const { data: pending } = await supabaseAdmin
      .from("pending_applications")
      .select("*")
      .eq("id", sub.pending_application_id)
      .maybeSingle();
    if (pending) {
      const { userId: uid, created, tempPassword } = await ensureUserForEmail(pending.email, pending.full_name, pending.phone ?? "");
      userId = uid;

      // Link submission to user
      await supabaseAdmin.from("payment_submissions").update({ user_id: uid }).eq("id", sub.id);
      await supabaseAdmin
        .from("pending_applications")
        .update({ user_id: uid, status: "paid" })
        .eq("id", pending.id);

      // Notify
      const loginLink = await generateLoginLink(pending.email, pending.claim_token);
      const body =
        `Your ${tier ?? pending.tier} membership payment is confirmed.` +
        (created && tempPassword ? ` Temporary password: ${tempPassword}.` : "") +
        (loginLink ? ` Sign in: ${loginLink}` : "");
      await supabaseAdmin.from("notifications").insert({
        user_id: uid,
        title: "Welcome to FAGE — payment confirmed",
        body,
        link: loginLink ?? "/dashboard",
      });
      // Send welcome email (best-effort)
      try {
        await sendTemplate("welcome", pending.email, {
          name: pending.full_name,
          tier: tier ?? pending.tier,
          temp_password: tempPassword ?? "(use your existing password)",
          member_id: "(set after activation)",
          login_url: loginLink ?? `${siteOriginFromEnv()}/dashboard`,
        });
      } catch (e: any) { console.error("welcome email failed:", e?.message ?? e); }
    }
  }

  if (!userId) return; // nothing more we can do (manual bank w/ no pending row)

  // Resolve plan (prefer plan_id from pending_applications, fall back to tier match)
  let plan: any = null;
  if (sub.pending_application_id) {
    const { data: pa } = await supabaseAdmin
      .from("pending_applications")
      .select("plan_id")
      .eq("id", sub.pending_application_id)
      .maybeSingle();
    if (pa?.plan_id) {
      const { data: p } = await supabaseAdmin.from("subscription_plans").select("*").eq("id", pa.plan_id).maybeSingle();
      plan = p ?? null;
    }
  }
  if (!plan && tier) {
    const { data: p } = await supabaseAdmin.from("subscription_plans").select("*").eq("tier", tier).maybeSingle();
    plan = p ?? null;
  }
  const months = plan?.duration_months ?? 12;
  const planTier = (plan?.tier ?? tier) as Tier | null;

  // Existing profile?
  const { data: existing } = await supabaseAdmin
    .from("member_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const fromDate = existing?.subscription_expiry
    ? new Date(Math.max(now.getTime(), new Date(existing.subscription_expiry).getTime()))
    : now;
  const newExpiry = new Date(fromDate);
  newExpiry.setMonth(newExpiry.getMonth() + months);

  if (!existing) {
    // brand-new profile
    const { data: idRow } = await supabaseAdmin.rpc("generate_member_id", { _tier: planTier ?? "associate" });
    const memberId = (idRow as unknown as string) ?? null;
    let email = "";
    let fullName = "";
    let phone = "";
    let companyName = "";
    if (sub.pending_application_id) {
      const { data: pa } = await supabaseAdmin
        .from("pending_applications")
        .select("email,full_name,phone,company_name")
        .eq("id", sub.pending_application_id)
        .maybeSingle();
      email = pa?.email ?? "";
      fullName = pa?.full_name ?? "";
      phone = pa?.phone ?? "";
      companyName = pa?.company_name ?? "";
    }
    await supabaseAdmin.from("member_profiles").insert({
      user_id: userId,
      email,
      contact_name: fullName,
      phone,
      company_name: companyName,
      tier: planTier ?? "associate",
      status: "approved",
      member_id: memberId,
      subscription_start: now.toISOString(),
      subscription_expiry: new Date(now.getFullYear(), now.getMonth() + months, now.getDate()).toISOString(),
    });
  } else if (isRenew) {
    if (planTier && planTier !== existing.tier) {
      // tier change → new member id, reset start
      const { data: idRow } = await supabaseAdmin.rpc("generate_member_id", { _tier: planTier });
      const memberId = (idRow as unknown as string) ?? existing.member_id;
      const reset = new Date();
      reset.setMonth(reset.getMonth() + months);
      await supabaseAdmin.from("member_profiles").update({
        tier: planTier,
        member_id: memberId,
        subscription_start: now.toISOString(),
        subscription_expiry: reset.toISOString(),
        status: "approved",
      }).eq("user_id", userId);
    } else {
      // same tier → extend expiry only
      await supabaseAdmin.from("member_profiles").update({
        subscription_expiry: newExpiry.toISOString(),
        status: "approved",
      }).eq("user_id", userId);
    }
  }
}
