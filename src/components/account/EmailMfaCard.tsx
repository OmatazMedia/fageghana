import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck, ShieldOff } from "lucide-react";
import {
  disableEmailMfa,
  enableEmailMfa,
  getEmailMfaStatus,
  sendEmailMfaCode,
} from "@/lib/email-mfa.functions";

/** Email one-time-code second factor (complements the authenticator-app option). */
export function EmailMfaCard() {
  const statusFn = getEmailMfaStatus;
  const sendFn = sendEmailMfaCode;
  const enableFn = enableEmailMfa;
  const disableFn = disableEmailMfa;

  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<null | "enable" | "disable">(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const r = await statusFn();
      setEnabled(!!r.enabled);
    } catch {
      /* leave default */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function start(next: "enable" | "disable") {
    setBusy(true);
    try {
      const r = await sendFn();
      setSentTo(r.to);
      setMode(next);
      setCode("");
      toast.success(`Code sent to ${r.to}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not send the code");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    try {
      if (mode === "enable") {
        await enableFn({ data: { code } });
        toast.success("Email two-factor authentication enabled");
      } else {
        await disableFn({ data: { code } });
        toast.success("Email two-factor authentication disabled");
      }
      setMode(null);
      setCode("");
      setSentTo(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MailCheck className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Two-factor by email</h3>
          <p className="text-xs text-muted-foreground">
            Receive a 6-digit code by email at sign-in. Turning it on or off both require a code.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : mode ? (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            We emailed a 6-digit code to <span className="font-medium">{sentTo}</span>. It expires in
            10 minutes.
          </p>
          <input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
          />
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Verifying…" : mode === "enable" ? "Verify & enable" : "Verify & disable"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void start(mode)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(null);
                setCode("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : enabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <MailCheck className="h-4 w-4" /> Email two-factor authentication is enabled.
          </div>
          <button
            disabled={busy}
            onClick={() => void start("disable")}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60"
          >
            <ShieldOff className="h-3.5 w-3.5" /> {busy ? "Sending code…" : "Disable (needs code)"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Not enabled. Use this if you'd rather not install an authenticator app.
          </p>
          <button
            disabled={busy}
            onClick={() => void start("enable")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending code…" : "Enable email two-factor"}
          </button>
        </div>
      )}
    </section>
  );
}
