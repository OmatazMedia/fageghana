import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/account/change-password")({
  head: () => ({ meta: [{ title: "Change Password — FAGE Ghana" }] }),
  component: () => <ChangePasswordPage backHref="/account/security" />,
});

export function ChangePasswordPage({ backHref = "/account/security" }: { backHref?: string } = {}) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      password: pw,
      data: { must_change_password: false },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw("");
    setConfirm("");
    toast.success("Password updated");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/account/security"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Account & Security
        </Link>
        <h2 className="text-2xl font-bold">Change password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a strong password you don't use anywhere else. Minimum 8 characters.
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
            <span className="mb-1.5 block text-sm font-medium">New password</span>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
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
