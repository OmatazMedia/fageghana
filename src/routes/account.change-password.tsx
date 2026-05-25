import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/account/change-password")({
  head: () => ({ meta: [{ title: "Change Password — FAGE Ghana" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const mustChange = !!(user?.user_metadata as any)?.must_change_password;

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
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" /> Account security
        </div>
        <h1 className="text-2xl font-bold">
          {mustChange ? "Set a new password" : "Change your password"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mustChange
            ? "You're signed in with a temporary password. Please choose a new one to continue."
            : "Choose a new password for your FAGE account."}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">New password</span>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Confirm new password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
