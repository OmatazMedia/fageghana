import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createSchema = z.object({
  plan_id: z.string().uuid(),
  full_name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(5).max(40),
  company_name: z.string().max(160).optional().default(""),
});

/** Anonymous-friendly: capture contact details before payment. */
export const createPendingApplication = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: plan, error: planErr } = await supabaseAdmin
      .from("subscription_plans")
      .select("id,tier,active")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (!plan || plan.active === false) throw new Error("Plan unavailable");

    const { data: row, error } = await supabaseAdmin
      .from("pending_applications")
      .insert({
        plan_id: plan.id,
        tier: plan.tier,
        full_name: data.full_name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        company_name: (data.company_name ?? "").trim(),
        status: "awaiting_payment",
      })
      .select("id, claim_token, tier")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, claim_token: row.claim_token, tier: row.tier as string };
  });

/** Resolve a claim token (used on /apply/claim) to find the linked user. */
export const getPendingByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("pending_applications")
      .select("id, tier, email, full_name, company_name, phone, status, user_id, plan_id")
      .eq("claim_token", data.token)
      .maybeSingle();
    if (!row) throw new Error("Invalid or expired link");
    return row;
  });

/** Member-initiated renewal — creates a renewal payment_submissions row. */
export const startRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ plan_id: z.string().uuid(), gateway_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (!plan || plan.active === false) throw new Error("Plan unavailable");
    return {
      tier: plan.tier as string,
      plan_id: plan.id,
      gateway_id: data.gateway_id,
      user_id: context.userId,
    };
  });
