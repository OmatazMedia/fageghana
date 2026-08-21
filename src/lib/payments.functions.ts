// @ts-nocheck
import { z } from "zod";
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

function siteOrigin() {
  return typeof window !== "undefined" ? window.location.origin : "";
}

function makeReference(tier: string) {
  return `FAGE-${tier.toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function listEnabledGateways() {
  const { data, error } = await api.rpc("list_enabled_gateways");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

async function loadGateway(gatewayId: string) {
  const gateways = await listEnabledGateways();
  const gateway = gateways.find((g: any) => g.id === gatewayId);
  if (!gateway || !gateway.enabled) throw new Error("Gateway not available");
  return gateway;
}

async function loadPlan(planId: string | null, tier: string | null) {
  if (planId) {
    const { data } = await api
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    if (data) return data;
  }
  if (tier) {
    const { data } = await api
      .from("subscription_plans")
      .select("*")
      .eq("tier", tier as any)
      .maybeSingle();
    if (data) return data;
  }
  throw new Error("Plan not found");
}

async function resolvePendingApplication(id: string) {
  const { data, error } = await api
    .from("pending_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (data) return data;
  if (error?.status === 401) {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const token = params.get("token") || "";
    if (token) {
      const { data: pa } = await api.rpc("get_pending_application", { _token: token });
      const row = Array.isArray(pa) ? pa[0] : pa;
      if (row && row.id === id) return row;
    }
  }
  throw new Error("Application not found");
}

async function publicInitialize(provider: string, body: any) {
  const endpoints: Record<string, string> = {
    paystack: "/payments/paystack/initialize",
    flutterwave: "/payments/flutterwave/initialize",
    hubtel: "/payments/hubtel/initialize",
  };
  const ep = endpoints[provider];
  if (!ep) throw new Error(`Online payments not supported for provider: ${provider}`);
  const { data, error } = await api.request(ep, { method: "POST", body: JSON.stringify(body) });
  if (error) throw new Error(error.message);
  return data ?? {};
}

// ─────────────────────────────────────────────────────────────────────
// Anonymous: initialize a payment for a pending application
// ─────────────────────────────────────────────────────────────────────

const initAnonSchema = z.object({
  pending_application_id: z.string().uuid(),
  gateway_id: z.string().uuid(),
});

export async function initApplicationPayment(input: any): Promise<any> {
  const data = input?.data ?? input;
  const v = initAnonSchema.parse(data);

  const pending = await resolvePendingApplication(v.pending_application_id);
  if (pending.status === "claimed")
    throw new Error("This application has already been completed");

  const gateway = await loadGateway(v.gateway_id);
  const plan = await loadPlan(pending.plan_id, pending.tier);

  const provider = gateway.provider;
  const init = await publicInitialize(provider, {
    pending_application_id: pending.id,
    amount: Number(plan.amount),
    currency: plan.currency || "GHS",
    email: pending.email,
    description: `FAGE ${plan.tier} membership`,
  });
  const reference = init.reference ?? makeReference(plan.tier);
  const origin = siteOrigin();

  if (provider === "paystack") {
    const authorization_url = init.authorization_url ?? init.redirect_url;
    if (!authorization_url) throw new Error("Paystack init failed");
    return {
      mode: "paystack_inline" as const,
      redirect_url: authorization_url,
      authorization_url,
      access_code: init.access_code as string | undefined,
      public_key: gateway.public_key,
      email: pending.email,
      amount: Math.round(Number(plan.amount) * 100),
      currency: plan.currency || "GHS",
      reference,
      callback_url: `${origin}/payment/callback?token=${pending.claim_token}`,
    };
  }

  if (provider === "flutterwave") {
    const redirect_url = init.flutterwave_url ?? init.authorization_url ?? init.redirect_url;
    if (!redirect_url) throw new Error("Flutterwave init failed");
    return {
      mode: "flutterwave_inline" as const,
      redirect_url,
      public_key: gateway.public_key,
      tx_ref: reference,
      amount: Number(plan.amount),
      currency: plan.currency || "GHS",
      email: pending.email,
      name: pending.full_name,
      phone: pending.phone,
      callback_url: `${origin}/payment/callback?token=${pending.claim_token}`,
    };
  }

  if (provider === "hubtel") {
    const checkout_url = init.checkout_url ?? init.authorization_url ?? init.redirect_url;
    if (!checkout_url) throw new Error("Hubtel init failed");
    return { redirect_url: checkout_url, reference };
  }

  throw new Error(`Online payments not supported for provider: ${provider}`);
}

// ─────────────────────────────────────────────────────────────────────
// Authenticated: initialize a renewal payment
// ─────────────────────────────────────────────────────────────────────

const initRenewalSchema = z.object({
  plan_id: z.string().uuid(),
  gateway_id: z.string().uuid(),
});

export async function initRenewalPayment(input: any): Promise<any> {
  const data = input?.data ?? input;
  const v = initRenewalSchema.parse(data);

  const gateway = await loadGateway(v.gateway_id);
  const plan = await loadPlan(v.plan_id, null);
  if (plan.active === false) throw new Error("Plan unavailable");

  const { data: userData } = await api.auth.getUser();
  const user = userData?.user;
  let email = user?.email ?? "";
  let name: string | undefined;
  let phone: string | undefined;
  if (user?.id) {
    const { data: profile } = await api
      .from("member_profiles")
      .select("email,contact_name,phone")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile) {
      email = profile.email ?? email;
      name = profile.contact_name ?? undefined;
      phone = profile.phone ?? undefined;
    }
  }
  if (!email) throw new Error("Email missing on profile");

  const origin = siteOrigin();
  const { data: init, error } = await api.request("/member/payments/initialize", {
    method: "POST",
    body: JSON.stringify({
      plan_id: v.plan_id,
      gateway_id: v.gateway_id,
      provider: gateway.provider,
      amount: Number(plan.amount),
    }),
  });
  if (error) throw new Error(error.message);
  const r = init ?? {};
  const reference = r.reference ?? makeReference(plan.tier);

  if (gateway.provider === "paystack") {
    const authorization_url = r.authorization_url ?? r.redirect_url;
    if (!authorization_url) throw new Error("Paystack init failed");
    return {
      mode: "paystack_inline" as const,
      redirect_url: authorization_url,
      authorization_url,
      access_code: r.access_code as string | undefined,
      public_key: gateway.public_key,
      email,
      amount: Math.round(Number(plan.amount) * 100),
      currency: plan.currency || "GHS",
      reference,
      callback_url: `${origin}/payment/callback`,
    };
  }

  if (gateway.provider === "hubtel") {
    const checkout_url = r.checkout_url ?? r.authorization_url ?? r.redirect_url;
    if (!checkout_url) throw new Error("Hubtel init failed");
    return { redirect_url: checkout_url, reference };
  }

  if (gateway.provider === "flutterwave") {
    const redirect_url = r.flutterwave_url ?? r.authorization_url ?? r.redirect_url;
    if (!redirect_url) throw new Error("Flutterwave init failed");
    return {
      mode: "flutterwave_inline" as const,
      redirect_url,
      public_key: gateway.public_key,
      tx_ref: reference,
      amount: Number(plan.amount),
      currency: plan.currency || "GHS",
      email,
      name,
      phone,
      callback_url: `${origin}/payment/callback`,
    };
  }

  throw new Error(`Renewal not supported for provider: ${gateway.provider}`);
}

// ─────────────────────────────────────────────────────────────────────
// Anonymous-friendly verify by reference (reference is itself the secret)
// ─────────────────────────────────────────────────────────────────────

export async function verifyPayment(input: any): Promise<any> {
  const data = input?.data ?? input;
  const v = z.object({ reference: z.string().min(8).max(120) }).parse(data);

  const { data: sub } = await api
    .from("payment_submissions")
    .select("*")
    .eq("reference", v.reference)
    .maybeSingle();
  if (sub?.status === "confirmed") {
    return { status: "confirmed" as const, submission: sub };
  }

  const { data: res, error } = await api.request("/member/payments/verify", {
    method: "POST",
    body: JSON.stringify({ reference: v.reference, provider: sub?.method }),
  });
  if (error) throw new Error(error.message);

  const status: "confirmed" | "pending" = res?.status === "confirmed" ? "confirmed" : "pending";
  const submission = res?.data?.submission ?? res?.data ?? res ?? sub;
  if (status === "pending") return { status, submission, raw: res?.raw };
  return { status, submission };
}

export async function testPaymentGateway(input: any): Promise<any> {
  const data = input?.data ?? input;
  const v = z.object({ gateway_id: z.string().uuid() }).parse(data);

  const { data: gateway } = await api
    .from("payment_gateways")
    .select("*")
    .eq("id", v.gateway_id)
    .maybeSingle();
  if (!gateway) throw new Error("Gateway not found");

  const { data: res, error } = await api.request(
    `/admin/payment-gateways/${encodeURIComponent(gateway.provider)}/test`,
    { method: "POST", body: JSON.stringify({}) },
  );
  if (error) throw new Error(error.message);

  const ok = res?.ok === true || res?.status === "ok";
  return {
    ok,
    message: res?.message ?? (ok ? "Gateway keys are valid and can reach the gateway." : "Gateway test failed."),
    callback_url: `${siteOrigin()}/payment/callback`,
    webhook_url: `${siteOrigin()}/api/public/${gateway.provider}-webhook`,
  };
}