import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/** Sends a fresh 6-digit code to the signed-in user's email address. */
export const sendEmailMfaCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { issueEmailOtp } = await import("./email-mfa.server");
    return issueEmailOtp(context.userId);
  });

/** Verifies a code and turns email 2FA on for the signed-in user. */
export const enableEmailMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { consumeEmailOtp, setEmailMfa } = await import("./email-mfa.server");
    await consumeEmailOtp(context.userId, data.code);
    await setEmailMfa(context.userId, true);
    return { ok: true };
  });

/** Verifies a code and turns email 2FA off for the signed-in user. */
export const disableEmailMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { consumeEmailOtp, setEmailMfa } = await import("./email-mfa.server");
    await consumeEmailOtp(context.userId, data.code);
    await setEmailMfa(context.userId, false);
    return { ok: true };
  });

/** Verifies a code during sign-in (session already exists at aal1). */
export const verifyEmailMfaChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => codeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { consumeEmailOtp } = await import("./email-mfa.server");
    await consumeEmailOtp(context.userId, data.code);
    return { ok: true };
  });

/** Whether the signed-in user has email 2FA switched on. */
export const getEmailMfaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_email_mfa")
      .select("enabled, enabled_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { enabled: !!data?.enabled, enabled_at: data?.enabled_at ?? null };
  });
