import { createServerFn } from "@tanstack/react-start";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finalizePaymentConfirmation } from "./membership.server";

function siteOrigin() {
  const proto = (getRequestHeader("x-forwarded-proto") || "https").split(",")[0]!.trim();
  const host = getRequestHost();
  return `${proto}://${host}`;
}

function makeReference(tier: string) {
  return `FAGE-${tier.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadGateway(gatewayId: string) {
  const { data: gateway } = await supabaseAdmin.from("payment_gateways").select("*").eq("id", gatewayId).maybeSingle();
  if (!gateway || !gateway.enabled) throw new Error("Gateway not available");
  return gateway;
}

function paystackSecret(gateway: any) {
  return (((gateway.config as any)?.secret_key as string | undefined) || process.env.PAYSTACK_SECRET_KEY || "").trim();
}

function paystackPublicKey(gateway: any) {
  return (((gateway.config as any)?.public_key as string | undefined) || process.env.PAYSTACK_PUBLIC_KEY || "").trim();
}

async function initializePaystack(input: {
  gateway: any;
  email: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, any>;
  submissionId: string;
}) {
  const secret = paystackSecret(input.gateway);
  const publicKey = paystackPublicKey(input.gateway);
  if (!secret) throw new Error("Paystack is not configured — add a secret key in Admin → Gateways");
  if (!publicKey) throw new Error("Paystack is not configured — add a public key in Admin → Gateways");
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(Number(input.amount) * 100),
      currency: input.currency || "GHS",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status) {
    const msg = json?.message ?? `HTTP ${res.status}`;
    const friendly = /currency not supported/i.test(msg)
      ? `Paystack rejected currency "${input.currency}". Your Paystack account is registered in a different country/currency. Either change the plan currency in Admin → Plans to match your Paystack account (e.g. NGN for a Nigerian account, GHS for a Ghanaian account), or contact Paystack Support to enable multi-currency on your account.`
      : `Paystack init failed: ${msg}`;
    await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: friendly }).eq("id", input.submissionId);
    throw new Error(friendly);
  }
  return {
    mode: "paystack_inline" as const,
    redirect_url: json.data.authorization_url as string,
    authorization_url: json.data.authorization_url as string,
    access_code: json.data.access_code as string | undefined,
    public_key: publicKey,
    email: input.email,
    amount: Math.round(Number(input.amount) * 100),
    currency: input.currency || "GHS",
    reference: input.reference,
    callback_url: input.callbackUrl,
  };
}

function flutterwaveSecret(gateway: any) {
  return (((gateway.config as any)?.secret_key as string | undefined) || "").trim();
}
function flutterwavePublicKey(gateway: any) {
  return (((gateway.config as any)?.public_key as string | undefined) || "").trim();
}

async function initializeFlutterwave(input: {
  gateway: any;
  email: string;
  name?: string;
  phone?: string;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, any>;
  submissionId: string;
}) {
  const secret = flutterwaveSecret(input.gateway);
  const publicKey = flutterwavePublicKey(input.gateway);
  if (!secret) throw new Error("Flutterwave is not configured — add a secret key in Admin → Gateways");
  if (!publicKey) throw new Error("Flutterwave is not configured — add a public key in Admin → Gateways");
  const res = await fetch("https://api.flutterwave.com/v3/payments", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      tx_ref: input.reference,
      amount: Number(input.amount),
      currency: input.currency || "GHS",
      redirect_url: input.callbackUrl,
      customer: { email: input.email, name: input.name || input.email, phonenumber: input.phone || "" },
      customizations: { title: "FAGE Ghana Membership", description: "Membership payment" },
      meta: input.metadata,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== "success") {
    const msg = json?.message ?? `HTTP ${res.status}`;
    const friendly = /currency/i.test(msg)
      ? `Flutterwave rejected currency "${input.currency}". Either change the plan currency in Admin → Plans to one your Flutterwave account supports, or enable that currency in your Flutterwave dashboard.`
      : `Flutterwave init failed: ${msg}`;
    await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: friendly }).eq("id", input.submissionId);
    throw new Error(friendly);
  }
  return {
    mode: "flutterwave_inline" as const,
    redirect_url: json.data?.link as string,
    public_key: publicKey,
    tx_ref: input.reference,
    amount: Number(input.amount),
    currency: input.currency || "GHS",
    email: input.email,
    name: input.name,
    phone: input.phone,
    callback_url: input.callbackUrl,
  };
}

async function loadPlan(planId: string | null, tier: string | null) {
  if (planId) {
    const { data } = await supabaseAdmin.from("subscription_plans").select("*").eq("id", planId).maybeSingle();
    if (data) return data;
  }
  if (tier) {
    const { data } = await supabaseAdmin.from("subscription_plans").select("*").eq("tier", tier as any).maybeSingle();
    if (data) return data;
  }
  throw new Error("Plan not found");
}

// ─────────────────────────────────────────────────────────────────────
// Anonymous: initialize a payment for a pending application
// ─────────────────────────────────────────────────────────────────────

const initAnonSchema = z.object({
  pending_application_id: z.string().uuid(),
  gateway_id: z.string().uuid(),
});

export const initApplicationPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => initAnonSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: pending } = await supabaseAdmin
      .from("pending_applications")
      .select("*")
      .eq("id", data.pending_application_id)
      .maybeSingle();
    if (!pending) throw new Error("Application not found");
    if (pending.status === "claimed") throw new Error("This application has already been completed");

    const gateway = await loadGateway(data.gateway_id);
    const plan = await loadPlan(pending.plan_id, pending.tier);

    const reference = makeReference(plan.tier);
    const origin = siteOrigin();

    // Insert pending payment_submissions row tied to the pending_application
    const { data: sub, error: subErr } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        user_id: pending.user_id, // may be null until account is created
        gateway_id: gateway.id,
        method: gateway.provider,
        amount: plan.amount,
        currency: plan.currency,
        duration_months: plan.duration_months,
        status: "pending",
        reference,
        kind: "new",
        pending_application_id: pending.id,
        member_message: `tier:${plan.tier}`,
      } as any)
      .select("*")
      .single();
    if (subErr) throw new Error(subErr.message);

    if (gateway.provider === "paystack") {
      return initializePaystack({
        gateway,
        email: pending.email,
        amount: Number(plan.amount),
        currency: plan.currency || "GHS",
        reference,
        callbackUrl: `${origin}/payment/callback?token=${pending.claim_token}`,
        metadata: { pending_application_id: pending.id, tier: plan.tier, submission_id: sub.id },
        submissionId: sub.id,
      });
    }

    if (gateway.provider === "hubtel") {
      const CLIENT_ID = process.env.HUBTEL_CLIENT_ID;
      const CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET;
      const MERCHANT = process.env.HUBTEL_MERCHANT_ACCOUNT;
      if (!CLIENT_ID || !CLIENT_SECRET || !MERCHANT) throw new Error("Hubtel is not configured");
      const auth = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
      const res = await fetch("https://payproxyapi.hubtel.com/items/initiate", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: Number(plan.amount),
          description: `FAGE ${plan.tier} membership`,
          callbackUrl: `${origin}/api/public/hubtel-callback`,
          returnUrl: `${origin}/payment/callback?reference=${reference}&provider=hubtel&token=${pending.claim_token}`,
          cancellationUrl: `${origin}/membership`,
          merchantAccountNumber: MERCHANT,
          clientReference: reference,
          payeeName: pending.full_name,
          payeeEmail: pending.email,
          payeeMobileNumber: pending.phone,
        }),
      });
      const json: any = await res.json();
      const checkoutUrl: string | undefined = json?.data?.checkoutUrl ?? json?.data?.checkoutDirectUrl;
      if (!res.ok || !checkoutUrl) {
        await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: `init failed: ${JSON.stringify(json).slice(0, 300)}` }).eq("id", sub.id);
        throw new Error(`Hubtel init failed: ${json?.message ?? res.status}`);
      }
      return { redirect_url: checkoutUrl, reference };
    }

    if (gateway.provider === "flutterwave") {
      return initializeFlutterwave({
        gateway,
        email: pending.email,
        name: pending.full_name,
        phone: pending.phone,
        amount: Number(plan.amount),
        currency: plan.currency || "GHS",
        reference,
        callbackUrl: `${origin}/payment/callback?token=${pending.claim_token}`,
        metadata: { pending_application_id: pending.id, tier: plan.tier, submission_id: sub.id },
        submissionId: sub.id,
      });
    }

    throw new Error(`Online payments not supported for provider: ${gateway.provider}`);
  });

// ─────────────────────────────────────────────────────────────────────
// Authenticated: initialize a renewal payment
// ─────────────────────────────────────────────────────────────────────

const initRenewalSchema = z.object({
  plan_id: z.string().uuid(),
  gateway_id: z.string().uuid(),
});

export const initRenewalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initRenewalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const gateway = await loadGateway(data.gateway_id);
    const plan = await loadPlan(data.plan_id, null);
    if (plan.active === false) throw new Error("Plan unavailable");

    const { data: profile } = await supabaseAdmin.from("member_profiles").select("email,contact_name,phone").eq("user_id", context.userId).maybeSingle();
    const email = profile?.email || (context.claims as any)?.email;
    if (!email) throw new Error("Email missing on profile");

    const reference = makeReference(plan.tier);
    const origin = siteOrigin();

    const { data: sub, error: subErr } = await supabaseAdmin
      .from("payment_submissions")
      .insert({
        user_id: context.userId,
        gateway_id: gateway.id,
        method: gateway.provider,
        amount: plan.amount,
        currency: plan.currency,
        duration_months: plan.duration_months,
        status: "pending",
        reference,
        kind: "renew",
        member_message: `tier:${plan.tier}|renew:${plan.id}`,
      })
      .select("*")
      .single();
    if (subErr) throw new Error(subErr.message);

    if (gateway.provider === "paystack") {
      return initializePaystack({
        gateway,
        email,
        amount: Number(plan.amount),
        currency: plan.currency || "GHS",
        reference,
        callbackUrl: `${origin}/payment/callback`,
        metadata: { user_id: context.userId, tier: plan.tier, kind: "renew", submission_id: sub.id },
        submissionId: sub.id,
      });
    }

    if (gateway.provider === "hubtel") {
      const CLIENT_ID = process.env.HUBTEL_CLIENT_ID!;
      const CLIENT_SECRET = process.env.HUBTEL_CLIENT_SECRET!;
      const MERCHANT = process.env.HUBTEL_MERCHANT_ACCOUNT!;
      const auth = "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
      const res = await fetch("https://payproxyapi.hubtel.com/items/initiate", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          totalAmount: Number(plan.amount),
          description: `FAGE ${plan.tier} renewal`,
          callbackUrl: `${origin}/api/public/hubtel-callback`,
          returnUrl: `${origin}/payment/callback?reference=${reference}&provider=hubtel`,
          cancellationUrl: `${origin}/dashboard`,
          merchantAccountNumber: MERCHANT,
          clientReference: reference,
          payeeName: profile?.contact_name ?? undefined,
          payeeEmail: email,
          payeeMobileNumber: profile?.phone ?? undefined,
        }),
      });
      const json: any = await res.json();
      const checkoutUrl: string | undefined = json?.data?.checkoutUrl ?? json?.data?.checkoutDirectUrl;
      if (!res.ok || !checkoutUrl) {
        await supabaseAdmin.from("payment_submissions").update({ status: "rejected", admin_notes: `init failed: ${JSON.stringify(json).slice(0, 300)}` }).eq("id", sub.id);
        throw new Error(`Hubtel init failed: ${json?.message ?? res.status}`);
      }
      return { redirect_url: checkoutUrl, reference };
    }

    throw new Error(`Renewal not supported for provider: ${gateway.provider}`);
  });

// ─────────────────────────────────────────────────────────────────────
// Anonymous-friendly verify by reference (reference is itself the secret)
// ─────────────────────────────────────────────────────────────────────

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ reference: z.string().min(8).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { data: sub } = await supabaseAdmin.from("payment_submissions").select("*").eq("reference", data.reference).maybeSingle();
    if (!sub) throw new Error("Payment not found");
    if (sub.status === "confirmed") {
      return { status: "confirmed" as const, submission: sub };
    }

    let confirmed = false;
    if (sub.method === "paystack") {
      let key = process.env.PAYSTACK_SECRET_KEY;
      if (sub.gateway_id) {
        const { data: gw } = await supabaseAdmin.from("payment_gateways").select("config").eq("id", sub.gateway_id).maybeSingle();
        const fromRow = (gw?.config as any)?.secret_key as string | undefined;
        if (fromRow) key = fromRow;
      }
      if (!key) throw new Error("Paystack secret key not configured");
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const json: any = await res.json();
      confirmed = !!(res.ok && json?.status && json?.data?.status === "success" && Number(json.data.amount) >= Math.round(Number(sub.amount) * 100));
      if (!confirmed) return { status: "pending" as const, submission: sub, raw: json?.data?.status };
    } else if (sub.method === "hubtel") {
      const id = process.env.HUBTEL_CLIENT_ID!;
      const secret = process.env.HUBTEL_CLIENT_SECRET!;
      const merchant = process.env.HUBTEL_MERCHANT_ACCOUNT!;
      const auth = "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
      const res = await fetch(`https://api-txnstatus.hubtel.com/transactions/${merchant}/status?clientReference=${encodeURIComponent(data.reference)}`, { headers: { Authorization: auth } });
      const json: any = await res.json();
      confirmed = json?.data?.status === "Paid";
      if (!confirmed) return { status: "pending" as const, submission: sub, raw: json?.data?.status };
    } else {
      throw new Error(`Unsupported method: ${sub.method}`);
    }

    const { data: updated } = await supabaseAdmin
      .from("payment_submissions")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", sub.id)
      .select("*")
      .single();

    try {
      await finalizePaymentConfirmation(sub.id);
    } catch (e: any) {
      console.error("finalizePaymentConfirmation failed:", e?.message ?? e);
    }
    return { status: "confirmed" as const, submission: updated };
  });

export const testPaymentGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ gateway_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: role } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("Admin only");
    const gateway = await loadGateway(data.gateway_id);
    if (gateway.provider !== "paystack") return { ok: false, message: `Testing is not available for ${gateway.provider}` };
    const secret = paystackSecret(gateway);
    const publicKey = paystackPublicKey(gateway);
    if (!secret || !publicKey) return { ok: false, message: "Add both Paystack public and secret keys first." };
    const res = await fetch("https://api.paystack.co/bank?currency=GHS", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.status) return { ok: false, message: json?.message ?? `Paystack returned ${res.status}` };
    return {
      ok: true,
      message: "Paystack keys are valid and can reach the gateway.",
      callback_url: `${siteOrigin()}/payment/callback`,
      webhook_url: `${siteOrigin()}/api/public/paystack-webhook`,
    };
  });
