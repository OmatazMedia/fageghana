import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roleEnum = z.enum(["admin", "superadmin", "staff", "moderator", "finance", "ceo", "developer", "coordinator"]);

async function assertAdmin(context: any) {
  const { data: roleRow } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden: admin only");
}

export type AdminUserRow = {
  user_id: string;
  email: string;
  full_name: string;
  role: "admin" | "superadmin" | "staff" | "moderator" | "finance" | "ceo" | "developer" | "coordinator";
  created_at: string;
};

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUserRow[] }> => {
    await assertAdmin(context);

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["admin", "staff", "moderator"]);
    if (rErr) throw new Error(rErr.message);

    const users: AdminUserRow[] = [];
    for (const r of roles ?? []) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
      if (!u?.user) continue;
      users.push({
        user_id: r.user_id,
        email: u.user.email ?? "",
        full_name:
          (u.user.user_metadata?.full_name as string | undefined) ?? "",
        role: r.role as AdminUserRow["role"],
        created_at: r.created_at,
      });
    }
    users.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { users };
  });

const createSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: roleEnum,
  mode: z.enum(["password", "invite"]),
  password: z.string().min(6).optional(),
});

export const createAdminUser = createServerFn({ method: "POST" })
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

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { userId };
  });

const changeRoleSchema = z.object({
  user_id: z.string().uuid(),
  role: roleEnum,
});

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changeRoleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId && data.role !== "admin") {
      throw new Error("You cannot demote your own admin account.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) {
      throw new Error("You cannot delete your own account.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ── Bulk member CSV invite ─────────────────────────────────────────── */

const bulkRowSchema = z.object({
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  company_name: z.string().trim().max(160).optional().nullable(),
  tier: z.enum(["associate", "standard", "corporate"]).optional().nullable(),
});

const bulkInviteSchema = z.object({
  rows: z.array(bulkRowSchema).min(1).max(500),
  redirectOrigin: z.string().url(),
});

export type BulkInviteResult = {
  succeeded: number;
  failed: { email: string; reason: string }[];
};

export const bulkInviteMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bulkInviteSchema.parse(d))
  .handler(async ({ data, context }): Promise<BulkInviteResult> => {
    await assertAdmin(context);

    const redirectTo = `${data.redirectOrigin.replace(/\/$/, "")}/reset-password`;
    const failed: { email: string; reason: string }[] = [];
    let succeeded = 0;

    for (const row of data.rows) {
      try {
        // Try invite first; if user already exists, fall back to upserting profile only.
        const { data: invited, error: invErr } =
          await supabaseAdmin.auth.admin.inviteUserByEmail(row.email, {
            data: { full_name: row.full_name },
            redirectTo,
          });

        let userId: string | undefined = invited?.user?.id;

        if (invErr) {
          // Likely "User already registered" — look them up so we still seed profile fields.
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          const existing = list?.users.find(
            (u) => u.email?.toLowerCase() === row.email.toLowerCase(),
          );
          if (!existing) {
            failed.push({ email: row.email, reason: invErr.message });
            continue;
          }
          userId = existing.id;
        }

        if (!userId) {
          failed.push({ email: row.email, reason: "No user id returned" });
          continue;
        }

        // Upsert member_profiles with provided fields. Subscription stays unset
        // until the member pays for a plan (or admin attaches one separately).
        const { error: profErr } = await supabaseAdmin
          .from("member_profiles")
          .upsert(
            {
              user_id: userId,
              contact_name: row.full_name,
              email: row.email,
              phone: row.phone ?? "",
              company_name: row.company_name ?? "",
              tier: row.tier ?? "associate",
            } as any,
            { onConflict: "user_id" },
          );
        if (profErr) {
          failed.push({ email: row.email, reason: profErr.message });
          continue;
        }

        succeeded++;
      } catch (e: any) {
        failed.push({ email: row.email, reason: e?.message ?? String(e) });
      }
    }

    return { succeeded, failed };
  });
