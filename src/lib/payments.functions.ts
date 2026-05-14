import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finalizePaymentConfirmation } from "./membership.server";

type Tier = "associate" | "standard" | "corporate";

function siteOrigin() {
  const proto = (getRequestHeader("x-forwarded-proto") || "https").split(",")[0]!.trim();
  const host = getRequestHost();
  return `${proto}://${host}`;
}

const initSchema = z.object({
  tier: z.enum(["associate", "standard", "corporate"]),
  gateway_id: z.string().uuid(),
  pending_application_id: z.string().uuid().optional(),
  kind: z.enum(["new", "renew"]).optional().default("new"),
});

const initAnonSchema = z.object({
  pending_application_id: z.string().uuid(),
  gateway_id: z.string().uuid(),
});

async function loadPlanAndGateway(tier: Tier, gatewayId: string) {
  const [{ data: plan }, { data: gateway }] = await Promise.all([
    supabaseAdmin.from("subscription_plans").select("*").eq("tier", tier).maybeSingle(),
    supabaseAdmin.from("payment_gateways").select("*").eq("id", gatewayId).maybeSingle(),
  ]);
  if (!plan) throw new Error("Plan not found");
  if (!gateway || !gateway.enabled) throw new Error("Gateway not available");
  return { plan, gateway };
}

/** Initialize Paystack — returns authorization_url to redirect to. */
export const initPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initSchema.parse(d))
  .handler(async ({ data, context }) => {
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    if (!PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_SECRET_KEY is not configured");

    const { plan, gateway } = await loadPlanAndGateway(data.tier, data.gateway_id);
    if (gateway.provider !== "paystack") throw new Error("Gateway is not Paystack");

    // Get user's email
    const { data: profile } = await supabaseAdmin.from("member_profiles").select("email").eq("user_id", context.userId).maybeSingle();
    const email = profile?.email || (context.claims as any)?.email;
    if (!email) throw new Error("Member email missing — update your profile first");

    const reference = `FAGE-${data.tier.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const callback_url = `${siteOrigin()}/payment/callback`;

    // Create pending submission
    const { data: sub, error: subErr } = await supabaseAdmin.from("payment_submissions").insert({
      user_id: context.userId,
      gateway_id: gateway.id,
      method: "paystack",
      amount: plan.amount,
      currency: plan.currency,
      duration_months: plan.duration_months,
      status: "pending",
      reference,
      member_message: `tier:${data.tier}`,
    }).select("*").single();
    if (subErr) throw new Error(subErr.message);

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(plan.amount) * 100), // pesewas
        currency: plan.currency || "GHS",
        reference,
        callback_url,
        metadata: { user_id: context.userId, tier: data.tier, submission_id: sub.id },
      }),
    });
    const json: any = await res.json();
    if (!res.ok || !json?.status) {
      await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: `init failed: ${json?.message ?? res.status}` }).eq("id", sub.id);
      throw new Error(`Paystack init failed: ${json?.message ?? res.status}`);
    }
    return { authorization_url: json.data.authorization_url as string, reference };
  });

/** Initialize Hubtel checkout — returns checkoutUrl. */
export const initHubtel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initSchema.parse(d))
  .handler(async ({ data, context }) => {
    const CLIENT_ID = process.env.HUBTEL_CLIENT_ID;
    const CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET;
    const MERCHANT = process.env.HUBTEL_MERCHANT_ACCOUNT;
    if (!CLIENT_ID || !CLIENT_SECRET || !MERCHANT) throw new Error("Hubtel env vars are not configured");

    const { plan, gateway } = await loadPlanAndGateway(data.tier, data.gateway_id);
    if (gateway.provider !== "hubtel") throw new Error("Gateway is not Hubtel");

    const { data: profile } = await supabaseAdmin.from("member_profiles").select("email,contact_name,phone").eq("user_id", context.userId).maybeSingle();
    const email = profile?.email || (context.claims as any)?.email;

    const reference = `FAGE-${data.tier.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const origin = siteOrigin();

    const { data: sub, error: subErr } = await supabaseAdmin.from("payment_submissions").insert({
      user_id: context.userId,
      gateway_id: gateway.id,
      method: "hubtel",
      amount: plan.amount,
      currency: plan.currency,
      duration_months: plan.duration_months,
      status: "pending",
      reference,
      member_message: `tier:${data.tier}`,
    }).select("*").single();
    if (subErr) throw new Error(subErr.message);

    const auth = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://payproxyapi.hubtel.com/items/initiate", {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        totalAmount: Number(plan.amount),
        description: `FAGE ${data.tier} membership`,
        callbackUrl: `${origin}/api/public/hubtel-callback`,
        returnUrl: `${origin}/payment/callback?reference=${reference}&provider=hubtel`,
        cancellationUrl: `${origin}/membership`,
        merchantAccountNumber: MERCHANT,
        clientReference: reference,
        payeeName: profile?.contact_name ?? undefined,
        payeeEmail: email ?? undefined,
        payeeMobileNumber: profile?.phone ?? undefined,
      }),
    });
    const json: any = await res.json();
    const checkoutUrl: string | undefined = json?.data?.checkoutUrl ?? json?.data?.checkoutDirectUrl;
    if (!res.ok || !checkoutUrl) {
      await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: `init failed: ${JSON.stringify(json).slice(0,300)}` }).eq("id", sub.id);
      throw new Error(`Hubtel init failed: ${json?.message ?? json?.responseText ?? res.status}`);
    }
    return { checkoutUrl, reference };
  });

/** Verify a payment by reference; idempotent — confirms the submission if successful. */
export const verifyPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ reference: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: sub } = await supabaseAdmin.from("payment_submissions").select("*").eq("reference", data.reference).maybeSingle();
    if (!sub) throw new Error("Payment not found");
    if (sub.user_id !== context.userId) throw new Error("Forbidden");
    if (sub.status === "confirmed") return { status: "confirmed" as const, submission: sub };

    if (sub.method === "paystack") {
      const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!;
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      });
      const json: any = await res.json();
      const ok = res.ok && json?.status && json?.data?.status === "success" && Number(json.data.amount) >= Math.round(Number(sub.amount) * 100);
      if (!ok) return { status: "pending" as const, submission: sub, raw: json?.data?.status };
      const { data: updated } = await supabaseAdmin.from("payment_submissions").update({
        status: "confirmed", confirmed_at: new Date().toISOString(),
      }).eq("id", sub.id).select("*").single();
      return { status: "confirmed" as const, submission: updated };
    }

    if (sub.method === "hubtel") {
      const CLIENT_ID = process.env.HUBTEL_CLIENT_ID!;
      const CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET!;
      const MERCHANT = process.env.HUBTEL_MERCHANT_ACCOUNT!;
      const auth = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
      const url = `https://api-txnstatus.hubtel.com/transactions/${MERCHANT}/status?clientReference=${encodeURIComponent(data.reference)}`;
      const res = await fetch(url, { headers: { Authorization: auth } });
      const json: any = await res.json();
      const status = json?.data?.status;
      if (status !== "Paid") return { status: "pending" as const, submission: sub, raw: status };
      const { data: updated } = await supabaseAdmin.from("payment_submissions").update({
        status: "confirmed", confirmed_at: new Date().toISOString(),
      }).eq("id", sub.id).select("*").single();
      return { status: "confirmed" as const, submission: updated };
    }

    throw new Error(`Unsupported method: ${sub.method}`);
  });
