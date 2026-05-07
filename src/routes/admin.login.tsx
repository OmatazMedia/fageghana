import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthSplit } from "@/components/auth/AuthSplit";
import heroImg from "@/assets/auth-admin.jpg";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — FAGE Ghana" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const { signIn, signUp, user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate({ to: "/admin" });
  }, [loading, user, isAdmin, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(mode === "signup" ? "Account created. An existing admin can grant you access." : "Signed in");
  }

  return (
    <AuthSplit
      imageUrl={heroImg}
      eyebrow="FAGE Admin Console"
      title="Run the federation from one calm, focused workspace."
      subtitle="Manage members, payments, certificates, content and support — all in one place."
      bullets={[
        "Approve membership applications",
        "Confirm payments & extend subscriptions",
        "Design and issue certificates",
        "Build dynamic application forms",
        "Broadcast notifications to members",
        "Resolve support tickets",
      ]}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">FAGE Admin</h1>
          <p className="text-xs text-muted-foreground">Content management portal</p>
        </div>
      </div>

      {user && !isAdmin && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          You are signed in but don't have admin access. Contact an existing admin to be granted access.
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <p className="mt-1 text-xs text-muted-foreground">Password is shown for clarity — type carefully.</p>
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary">
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </AuthSplit>
  );
}
