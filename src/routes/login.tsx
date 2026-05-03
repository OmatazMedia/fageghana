import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Member Login — FAGE Ghana" }] }),
  component: MemberLogin,
});

function MemberLogin() {
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await (mode === "signin" ? signIn(email, password) : signUp(email, password));
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(mode === "signin" ? "Welcome back" : "Account created. Check your email to confirm, then sign in.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-lg">
        <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Back to site</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">FAGE Member Portal</h1>
            <p className="text-xs text-muted-foreground">{mode === "signin" ? "Sign in to your account" : "Create a member account"}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Password</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button type="submit" disabled={busy} className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary">
          {mode === "signin" ? "New here? Create a member account" : "Already have an account? Sign in"}
        </button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Looking for the admin portal? <Link to="/admin/login" className="text-primary hover:underline">Admin login</Link>
        </p>
      </div>
    </div>
  );
}
