import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { logActivity } from "@/lib/activity.functions";
import { passwordStrength } from "@/lib/password-strength";

export const Route = createFileRoute("/account/change-password")({
  head: () => ({ meta: [{ title: "Change Password — FAGE Ghana" }] }),
  component: () => <ChangePasswordPage backHref="/account/security" />,
});

export function ChangePasswordPage({ backHref = "/account/security" }: { backHref?: string } = {}) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = useMemo(() => passwordStrength(pw), [pw]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return toast.error("Enter your current password");
    if (pw.length < 8) return toast.error("New password must be at least 8 characters");
    if (strength.score < 2) return toast.error("Please choose a stronger password");
    if (pw === current) return toast.error("New password must differ from your current one");
    if (pw !== confirm) return toast.error("Passwords do not match");

    setBusy(true);
    // Verify the current password first by re-authenticating with it.
    const { data: sess } = await supabase.auth.getUser();
    const email = sess.user?.email;
    if (!email) {
      setBusy(false);
      return toast.error("Your session expired. Please sign in again.");
    }
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (reauthErr) {
      setBusy(false);
      return toast.error("Current password is incorrect");
    }

    const { error } = await supabase.auth.updateUser({
      password: pw,
      data: { must_change_password: false },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCurrent("");
    setPw("");
    setConfirm("");
    void logActivity({ data: { event_type: "password_changed", detail: null } }).catch(() => {});
    toast.success("Password updated");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={backHref as any}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Account & Security
        </Link>
        <h2 className="text-2xl font-bold">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your current password, then pick a strong new one you don't use anywhere else.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold">New password</h3>
            <p className="text-xs text-muted-foreground">
              You'll stay signed in on this device after updating.
            </p>
          </div>
        </div>
        <form onSubmit={submit} className="max-w-md space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Current password</span>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">New password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {pw.length > 0 && (
            <div>
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.color : "bg-muted"}`}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs font-medium">
                Strength: <span className="font-semibold">{strength.label}</span>
              </p>
              {strength.hints.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {strength.hints.map((h) => (
                    <li key={h}>· {h}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Confirm new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}

