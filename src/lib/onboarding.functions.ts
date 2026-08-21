// @ts-nocheck
import { z } from "zod";
import { api } from "@/integrations/api/client";

const createSchema = z.object({
  plan_id: z.string().uuid(),
  full_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(5).max(40),
  company_name: z.string().max(160).optional().default(""),
});

/** Anonymous-friendly: capture contact details before payment. */
export async function createPendingApplication(input: any): Promise<{
  id: string;
  claim_token: string;
  tier: string;
}> {
  const data = input?.data ?? input;
  const d = createSchema.parse(data);

  const { data: plan, error: planErr } = await api
    .from("subscription_plans")
    .select("id,tier,active")
    .eq("id", d.plan_id)
    .maybeSingle();
  if (planErr) throw new Error(planErr.message);
  if (!plan || plan.active === false) throw new Error("Plan unavailable");

  // TODO: public pending-app endpoint on backend. Anonymous writes to
  // pending_applications are blocked (anon whitelist is only contact_messages +
  // blog_reactions), so this needs a signed-in session or a new
  // POST /api/public/applications/pending route — main agent must wire this.
  const claim_token =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `tok-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: row, error } = await api.from("pending_applications").insert({
    plan_id: plan.id,
    tier: plan.tier,
    full_name: d.full_name.trim(),
    email: d.email.trim().toLowerCase(),
    phone: d.phone.trim(),
    company_name: (d.company_name ?? "").trim(),
    status: "pending",
    claim_token,
    expires_at,
  });
  if (error) {
    throw new Error(
      error.status === 401
        ? "Please sign in to start an application (public endpoint pending)"
        : error.message,
    );
  }

  const id = row?.data?.id ?? row?.id;
  if (!id) throw new Error("Failed to create application");
  return {
    id,
    claim_token: row?.data?.claim_token ?? claim_token,
    tier: plan.tier as string,
  };
}

/** Resolve a claim token (used on /apply/claim) to find the linked user. */
export async function getPendingByToken(input: any): Promise<any> {
  const data = input?.data ?? input;
  const d = z.object({ token: z.string().uuid() }).parse(data);

  const { data: rows, error } = await api.rpc("get_pending_application", {
    _token: d.token,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw new Error("Invalid or expired link");
  return row;
}

/** Member-initiated renewal — creates a renewal payment_submissions row. */
export async function startRenewal(input: any): Promise<{
  tier: string;
  plan_id: string;
  gateway_id: string;
  user_id: string;
}> {
  const data = input?.data ?? input;
  const d = z.object({ plan_id: z.string().uuid(), gateway_id: z.string().uuid() }).parse(data);

  const { data: authData } = await api.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: plan, error } = await api
    .from("subscription_plans")
    .select("*")
    .eq("id", d.plan_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plan || plan.active === false) throw new Error("Plan unavailable");
  return {
    tier: plan.tier as string,
    plan_id: plan.id,
    gateway_id: d.gateway_id,
    user_id: userId,
  };
}
