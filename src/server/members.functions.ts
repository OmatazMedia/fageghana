import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().optional().default(""),
  company_name: z.string().optional().default(""),
  tier: z.enum(["associate", "standard", "corporate"]),
  mode: z.enum(["password", "invite"]),
  password: z.string().min(6).optional(),
});

export const createMemberAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: roleRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

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
      const redirectTo = `${process.env.SUPABASE_URL?.replace("supabase.co","").replace("https://","")}`;
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name: data.full_name },
      });
      if (error) throw new Error(error.message);
      userId = invited.user!.id;
      void redirectTo;
    }

    // Get plan duration
    const { data: plan } = await supabaseAdmin.from("subscription_plans").select("duration_months").eq("tier", data.tier).maybeSingle();
    const months = plan?.duration_months ?? 12;

    // Generate member id
    const { data: idRow } = await supabaseAdmin.rpc("generate_member_id", { _tier: data.tier });
    const memberId = idRow as unknown as string;

    const start = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);

    await supabaseAdmin.from("member_profiles").upsert({
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
    }, { onConflict: "user_id" });

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Welcome to FAGE",
      body: `Your ${data.tier} membership is active. Member ID: ${memberId}.`,
    });

    return { userId, memberId };
  });
