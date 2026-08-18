import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const roleEnum = z.enum(["admin", "superadmin", "staff", "moderator", "finance", "ceo", "developer", "coordinator"]);

/** Full-access roles: `developer` is a super-admin equivalent. */
const FULL_ACCESS_ROLES = ["admin", "superadmin", "developer"] as const;

async function assertAdmin(context: any) {
  const { data: roleRows } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .in("role", FULL_ACCESS_ROLES as unknown as string[]);
  if (!roleRows || roleRows.length === 0) throw new Error("Forbidden: admin only");
}

/** One role per user — replace any existing rows so no duplicates appear. */
async function setSoleRole(userId: string, role: string) {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role } as any);
  if (error) throw new Error(error.message);
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
      .in("role", ["admin", "superadmin", "staff", "moderator", "finance", "ceo", "developer", "coordinator"]);
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

    await setSoleRole(userId, data.role);

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
    if (
      data.user_id === context.userId &&
      !(FULL_ACCESS_ROLES as readonly string[]).includes(data.role)
    ) {
      throw new Error("You cannot demote your own admin account.");
    }
    await setSoleRole(data.user_id, data.role);
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
  password: z.string().min(8).max(72).optional().nullable(),
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

    
    const failed: { email: string; reason: string }[] = [];
    let succeeded = 0;

    const loginUrl = `${data.redirectOrigin.replace(/\/$/, "")}/login`;
    const welcomed: { email: string; full_name: string; withPassword: boolean }[] = [];

    for (const row of data.rows) {
      try {
        let userId: string | undefined;
        let firstError: string | null = null;

        if (row.password) {
          // Create a ready-to-use, confirmed account with the supplied password.
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email: row.email,
            password: row.password,
            email_confirm: true,
            user_metadata: { full_name: row.full_name },
          });
          userId = created?.user?.id;
          firstError = error?.message ?? null;
        } else {
          const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
            row.email,
            { data: { full_name: row.full_name }, redirectTo: `${loginUrl.replace(/\/login$/, "")}/reset-password` },
          );
          userId = invited?.user?.id;
          firstError = error?.message ?? null;
        }

        if (!userId && firstError) {
          // Likely "User already registered" — look them up so we still seed profile fields.
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          const existing = list?.users.find(
            (u) => u.email?.toLowerCase() === row.email.toLowerCase(),
          );
          if (!existing) {
            failed.push({ email: row.email, reason: firstError });
            continue;
          }
          userId = existing.id;
          if (row.password) {
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              password: row.password,
              email_confirm: true,
            });
          }
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
        welcomed.push({
          email: row.email,
          full_name: row.full_name,
          withPassword: !!row.password,
        });
      } catch (e: any) {
        failed.push({ email: row.email, reason: e?.message ?? String(e) });
      }
    }

    // Branded welcome emails (best-effort — never fails the import).
    if (welcomed.length) {
      const { sendEmail } = await import("@/lib/email/send.server");
      const { brandedEmail } = await import("@/lib/email/branded");
      for (const w of welcomed) {
        try {
          const { html, text } = brandedEmail({
            title: "Your FAGE member account is ready",
            paragraphs: w.withPassword
              ? [
                  `Hello ${w.full_name},`,
                  "An account has been created for you on the FAGE member portal. You can sign in right away using the email below and the password shared with you by the FAGE secretariat.",
                  "For your security, please change your password after your first sign-in from Account & Security.",
                ]
              : [
                  `Hello ${w.full_name},`,
                  "An account has been created for you on the FAGE member portal. Check your inbox for the invitation link to set your password, then sign in.",
                ],
            rows: [{ label: "Your login email", value: w.email }],
            ctaLabel: "Sign in to the member portal",
            ctaHref: loginUrl,
            footNote: "If you did not expect this email, please contact the FAGE secretariat.",
          });
          await sendEmail({
            to: w.email,
            subject: "Your FAGE member account is ready",
            html,
            text,
            templateKey: "member_welcome",
          });
        } catch {
          /* ignore email failures */
        }
      }
    }

    return { succeeded, failed };
  });

