import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthSplit } from "@/components/auth/AuthSplit";
import heroImg from "@/assets/auth-member.jpg";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set Password — FAGE Ghana" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery/invite link sets a session via the URL hash
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password set. Welcome!");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthSplit
      imageUrl={heroImg}
      eyebrow="FAGE Member Portal"
      title="Set your password"
      subtitle="Choose a password to activate your member account."
      bullets={[
        "Use at least 8 characters",
        "Mix letters and numbers",
        "Keep it private",
      ]}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Activate your account</h1>
          <p className="text-xs text-muted-foreground">Set a new password</p>
        </div>
      </div>
      {!ready ? (
        <p className="text-sm text-muted-foreground">This link is invalid or expired. Please request a new invitation from an admin.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">New password</label>
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Saving…" : "Set password"}
          </button>
        </form>
      )}
    </AuthSplit>
  );
}
