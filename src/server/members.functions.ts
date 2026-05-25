import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const tierEnum = z.enum(["associate", "standard", "corporate"]);
const statusEnum = z.enum(["new", "reviewing", "approved", "rejected"]);

async function assertAdmin(context: any) {
  const { data: roleRow } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden: admin only");
}

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().optional().default(""),
  company_name: z.string().optional().default(""),
  tier: tierEnum,
  mode: z.enum(["password", "invite"]),
  password: z.string().min(6).optional(),
});

export const createMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let userId: string;
    if (data.mode === "password") {
      if (!data.password) throw new Error("Password required");
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name },
      });
      if (error) throw new Error(error.message);
      userId = created.user!.id;
    } else {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email,
        { data: { full_name: data.full_name } },
      );
      if (error) throw new Error(error.message);
      userId = invited.user!.id;
    }

    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("duration_months")
      .eq("tier", data.tier)
      .maybeSingle();
    const months = plan?.duration_months ?? 12;

    const { data: idRow } = await supabaseAdmin.rpc("generate_member_id", { _tier: data.tier });
    const memberId = idRow as unknown as string;

    const start = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    await supabaseAdmin.from("member_profiles").upsert(
      {
        user_id: userId,
        email: data.email,
        contact_name: data.full_name,
        phone: data.phone || "",
        company_name: data.company_name || "",
        tier: data.tier,
        status: "approved",
        member_id: memberId,
        subscription_start: start.toISOString(),
        subscription_expiry: expiry.toISOString(),
      },
      { onConflict: "user_id" },
    );

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Welcome to FAGE",
      body: `Your ${data.tier} membership is active. Member ID: ${memberId}.`,
    });

    return { userId, memberId };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  contact_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  industry: z.string().optional().nullable(),
  country: z.string().optional(),
  status: statusEnum.optional(),
  subscription_expiry: z.string().optional().nullable(),
});

export const updateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { user_id, email, ...patch } = data;

    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update(patch)
      .eq("user_id", user_id);
    if (error) throw new Error(error.message);

    if (email) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
      if (authErr) throw new Error(authErr.message);
      await supabaseAdmin.from("member_profiles").update({ email }).eq("user_id", user_id);
    }
    return { ok: true };
  });

const changeTierSchema = z.object({
  user_id: z.string().uuid(),
  tier: tierEnum,
  regenerate_member_id: z.boolean().optional().default(false),
  extend_subscription: z.boolean().optional().default(false),
});

export const changeMemberTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changeTierSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const patch: Record<string, any> = { tier: data.tier };

    if (data.regenerate_member_id) {
      const { data: idRow } = await supabaseAdmin.rpc("generate_member_id", { _tier: data.tier });
      patch.member_id = idRow as unknown as string;
    }

    if (data.extend_subscription) {
      const { data: plan } = await supabaseAdmin
        .from("subscription_plans")
        .select("duration_months")
        .eq("tier", data.tier)
        .maybeSingle();
      const months = plan?.duration_months ?? 12;
      const start = new Date();
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + months);
      patch.subscription_start = start.toISOString();
      patch.subscription_expiry = expiry.toISOString();
    }

    const { error } = await supabaseAdmin
      .from("member_profiles")
      .update(patch as any)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      title: "Membership updated",
      body: `Your membership tier has been changed to ${data.tier}.`,
    });

    return { ok: true };
  });

const deleteSchema = z.object({
  user_id: z.string().uuid(),
  delete_auth_user: z.boolean().optional().default(true),
});

export const deleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error: profErr } = await supabaseAdmin
      .from("member_profiles")
      .delete()
      .eq("user_id", data.user_id);
    if (profErr) throw new Error(profErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);

    if (data.delete_auth_user) {
      const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
      if (authErr) throw new Error(authErr.message);
    }

    return { ok: true };
  });
