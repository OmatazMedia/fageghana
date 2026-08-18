import { createHash, randomInt, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { brandedEmail } from "@/lib/email/branded";
import { sendEmail } from "@/lib/email/send.server";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hash(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Issues a fresh 6-digit code, emails it, and invalidates any earlier codes. */
export async function issueEmailOtp(userId: string) {
  const { data: userRes, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = userRes?.user?.email;
  if (userErr || !email) throw new Error("Could not find your email address");

  // Invalidate outstanding codes so only the newest one works.
  await supabaseAdmin
    .from("email_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("purpose", "mfa")
    .is("consumed_at", null);

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60_000).toISOString();

  const { error } = await supabaseAdmin.from("email_otp_codes").insert({
    user_id: userId,
    purpose: "mfa",
    code_hash: hash(code),
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  const { html, text } = brandedEmail({
    title: "Your verification code",
    paragraphs: [
      "Use the code below to complete your two-factor verification. It expires in 10 minutes.",
      "If you did not request this code, someone may have your password — change it immediately.",
    ],
    rows: [
      { label: "Verification code", value: code },
      { label: "Valid for", value: `${TTL_MINUTES} minutes` },
    ],
    footNote: "Never share this code with anyone, including FAGE staff.",
  });

  const res = await sendEmail({
    to: email,
    subject: `FAGE verification code: ${code}`,
    html,
    text,
    templateKey: "email_mfa_code",
  });
  if (!res.ok) throw new Error(res.error ?? "Could not send the verification email");

  // Mask the destination so the UI can confirm where it went.
  const [name, domain] = email.split("@");
  const masked = `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`;
  return { sent: true, to: masked, expires_at: expiresAt };
}

/** Verifies and consumes the newest outstanding code, or throws. */
export async function consumeEmailOtp(userId: string, code: string) {
  const { data: row } = await supabaseAdmin
    .from("email_otp_codes")
    .select("id, code_hash, attempts, expires_at")
    .eq("user_id", userId)
    .eq("purpose", "mfa")
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) throw new Error("No active code — request a new one");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("That code has expired — request a new one");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("email_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);
    throw new Error("Too many incorrect attempts — request a new code");
  }

  const a = Buffer.from(hash(code));
  const b = Buffer.from(row.code_hash);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    await supabaseAdmin
      .from("email_otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    throw new Error("That code is not correct");
  }

  await supabaseAdmin
    .from("email_otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return true;
}

export async function setEmailMfa(userId: string, enabled: boolean) {
  const { error } = await supabaseAdmin.from("user_email_mfa").upsert(
    {
      user_id: userId,
      enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}
