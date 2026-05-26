import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shown after a successful password sign-in when the user has TOTP MFA enrolled
 * and the session needs to be upgraded from aal1 → aal2.
 */
export function MfaChallengeDialog({
  factorId,
  onSuccess,
  onCancel,
}: {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (error) return toast.error(error.message);
    onSuccess();
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
              Enter the 6-digit code from your authenticator app.
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
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Verifying…" : "Verify"}
          </button>
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
 * After a successful password sign-in, determine whether an MFA step is required.
 * Returns the TOTP factor ID to challenge, or null if no step is needed.
 */
export async function getRequiredMfaFactorId(): Promise<string | null> {
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal) return null;
  if (aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") return null;
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === "verified");
  return totp?.id ?? null;
}
