import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getEmailMfaStatus,
  sendEmailMfaCode,
  verifyEmailMfaChallenge,
} from "@/lib/email-mfa.functions";

export type MfaChallenge =
  | { kind: "totp"; factorId: string }
  | { kind: "email" };

/**
 * Shown after a successful password sign-in when the user has a second factor
 * enrolled — either a TOTP authenticator app (session upgrades aal1 → aal2)
 * or an emailed one-time code.
 */
export function MfaChallengeDialog({
  challenge,
  onSuccess,
  onCancel,
}: {
  challenge: MfaChallenge;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(challenge.kind === "email");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function sendCode() {
    setSending(true);
    try {
      const r = await sendEmailMfaCode();
      setSentTo(r.to);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send the code");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (challenge.kind === "email") void sendCode();
  }, [challenge.kind]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      if (challenge.kind === "totp") {
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: challenge.factorId,
          code,
        });
        if (error) throw new Error(error.message);
      } else {
        await verifyEmailMfaChallenge({ data: { code } });
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message ?? "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Two-factor authentication</h2>
            <p className="text-xs text-muted-foreground">
              {challenge.kind === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : sending
                  ? "Sending a code to your email…"
                  : `Enter the 6-digit code we emailed to ${sentTo ?? "your inbox"}.`}
            </p>
          </div>
        </div>
        <form onSubmit={verify} className="space-y-4">
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-full rounded-lg border border-input bg-background px-3 py-3 text-center font-mono text-2xl tracking-[0.4em]"
          />
          <button
            disabled={busy || sending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Verifying…" : "Verify"}
          </button>
          {challenge.kind === "email" && (
            <button
              type="button"
              disabled={sending}
              onClick={() => void sendCode()}
              className="w-full text-center text-xs font-medium text-primary hover:underline disabled:opacity-60"
            >
              {sending ? "Sending…" : "Resend code"}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel and sign out
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * After a successful password sign-in, determine which second factor (if any)
 * must be satisfied before the user is let through.
 */
export async function getRequiredMfaChallenge(): Promise<MfaChallenge | null> {
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");
    if (totp?.id) return { kind: "totp", factorId: totp.id };
  }
  try {
    const status = await getEmailMfaStatus();
    if (status.enabled) return { kind: "email" };
  } catch {
    /* if the check fails, don't lock the user out */
  }
  return null;
}

