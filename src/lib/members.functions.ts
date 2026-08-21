// @ts-nocheck
import { z } from "zod";
import { api } from "@/integrations/api/client";
import { tierAbbrev } from "@/lib/member-id";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

const tierEnum = z.enum(["associate", "standard", "corporate"]);
const statusEnum = z.enum(["new", "reviewing", "approved", "rejected"]);

async function assertAdmin(): Promise<string> {
  const { data } = await api.auth.getUser();
  const userId = data?.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const roles = Array.isArray(data?.user?.roles)
    ? data.user.roles.map((r: any) => (typeof r === "string" ? r : r?.role))
    : [];
  if (!roles.some((r) => ["admin", "superadmin", "developer"].includes(r))) {
    throw new Error("Forbidden: admin only");
  }
  return userId;
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

export async function createMemberAccount(
  input: any,
): Promise<{ userId: string; memberId: string }> {
  const data = input?.data ?? input;
  const d = createSchema.parse(data);
  await assertAdmin();

  const row: any = {
    email: d.email,
    full_name: d.full_name,
    phone: d.phone || undefined,
    company_name: d.company_name || undefined,
    tier: d.tier,
  };
  if (d.mode === "password" && d.password) row.password = d.password;

  const { data: inv, error: invErr } = await api.request("/admin/members/bulk-invite", {
    method: "POST",
    body: JSON.stringify({ rows: [row] }),
  });
  if (invErr) throw new Error(invErr.message);
  const r = unwrap(inv);
  if ((r?.succeeded ?? 0) < 1) {
    throw new Error(r?.failed?.[0]?.reason ?? "Member creation failed");
  }

  // bulk-invite may not return the new user id — find it via the users list.
  const { data: searchRes, error: sErr } = await api.request(
    `/admin/users?search=${encodeURIComponent(d.email)}`,
  );
  if (sErr) throw new Error(sErr.message);
  const users = Array.isArray(unwrap(searchRes)) ? unwrap(searchRes) : [];
  const user = users.find((u: any) => u.email?.toLowerCase() === d.email.toLowerCase()) ?? users[0];
  if (!user?.id) throw new Error("Created user not found");
  const userId = user.id;

  // TODO: prefer GET /admin/member-id/next?abbrev=... once the backend agent ships it.
  const { data: idRow } = await api.rpc("generate_structured_member_id", {
    _abbrev: tierAbbrev(d.tier),
  });
  const memberId = idRow as unknown as string;

  const { data: plan } = await api
    .from("subscription_plans")
    .select("duration_months")
    .eq("tier", d.tier)
    .maybeSingle();
  const months = plan?.duration_months ?? 12;

  const start = new Date();
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + months);

  const { error: upErr } = await api
    .from("member_profiles")
    .update({
      contact_name: d.full_name,
      email: d.email,
      phone: d.phone || "",
      company_name: d.company_name || "",
      tier: d.tier,
      status: "approved",
      member_id: memberId,
      subscription_start: start.toISOString(),
      subscription_expiry: expiry.toISOString(),
    })
    .eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);

  await api.from("notifications").insert({
    user_id: userId,
    title: "Welcome to FAGE",
    body: `Your ${d.tier} membership is active. Member ID: ${memberId}.`,
  });

  return { userId, memberId };
}

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

export async function updateMember(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = updateSchema.parse(data);
  await assertAdmin();
  const { user_id, email, ...patch } = d;

  const { error } = await api.from("member_profiles").update(patch).eq("user_id", user_id);
  if (error) throw new Error(error.message);

  if (email) {
    const { error: authErr } = await api.request(`/admin/users/${user_id}`, {
      method: "PUT",
      body: JSON.stringify({ email }),
    });
    if (authErr) throw new Error(authErr.message);
    const { error: pErr } = await api
      .from("member_profiles")
      .update({ email })
      .eq("user_id", user_id);
    if (pErr) throw new Error(pErr.message);
  }
  return { ok: true };
}

const changeTierSchema = z.object({
  user_id: z.string().uuid(),
  tier: tierEnum,
  regenerate_member_id: z.boolean().optional().default(false),
  extend_subscription: z.boolean().optional().default(false),
});

export async function changeMemberTier(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = changeTierSchema.parse(data);
  await assertAdmin();

  const patch: Record<string, any> = { tier: d.tier };

  if (d.regenerate_member_id) {
    // TODO: prefer GET /admin/member-id/next?abbrev=... once the backend agent ships it.
    const { data: idRow } = await api.rpc("generate_structured_member_id", {
      _abbrev: tierAbbrev(d.tier),
    });
    patch.member_id = idRow as unknown as string;
  }

  if (d.extend_subscription) {
    const { data: plan } = await api
      .from("subscription_plans")
      .select("duration_months")
      .eq("tier", d.tier)
      .maybeSingle();
    const months = plan?.duration_months ?? 12;
    const start = new Date();
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    patch.subscription_start = start.toISOString();
    patch.subscription_expiry = expiry.toISOString();
  }

  const { error } = await api
    .from("member_profiles")
    .update(patch as any)
    .eq("user_id", d.user_id);
  if (error) throw new Error(error.message);

  await api.from("notifications").insert({
    user_id: d.user_id,
    title: "Membership updated",
    body: `Your membership tier has been changed to ${d.tier}.`,
  });

  return { ok: true };
}

const deleteSchema = z.object({
  user_id: z.string().uuid(),
  delete_auth_user: z.boolean().optional().default(true),
});

export async function deleteMember(input: any): Promise<{ ok: true }> {
  const data = input?.data ?? input;
  const d = deleteSchema.parse(data);
  const userId = await assertAdmin();

  if (d.user_id === userId) {
    throw new Error("You cannot delete your own admin account.");
  }

  // The backend DELETE /admin/members/{id} keys on member_profiles.id, not user_id.
  const { data: prof } = await api
    .from("member_profiles")
    .select("id")
    .eq("user_id", d.user_id)
    .maybeSingle();

  if (prof?.id) {
    const { error } = await api.request(`/admin/members/${prof.id}`, { method: "DELETE" });
    if (error) throw new Error(error.message);
  }

  if (d.delete_auth_user !== false) {
    const { error } = await api.request(`/admin/users/${d.user_id}`, { method: "DELETE" });
    if (error) throw new Error(error.message);
  }

  return { ok: true };
}
