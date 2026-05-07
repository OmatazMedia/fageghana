import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthSplit } from "@/components/auth/AuthSplit";
import heroImg from "@/assets/auth-member.jpg";

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
    <AuthSplit
      imageUrl={heroImg}
      eyebrow="FAGE Member Portal"
      title="Grow your export business with Ghana's premier federation."
      subtitle="Sign in to manage your membership, renew your subscription, download your certificate and stay connected to opportunities."
      bullets={[
        "Official FAGE membership certificate",
        "Networking with 2,800+ exporters",
        "Trade fairs, missions and exhibitions",
        "Trainings, advisory and market intel",
        "Policy advocacy and recognition",
        "Member discounts on FAGE programs",
      ]}
      footer={
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Looking for the admin portal? <Link to="/admin/login" className="text-primary hover:underline">Admin login</Link>
        </p>
      }
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <UserCircle2 className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
          <p className="text-xs text-muted-foreground">{mode === "signin" ? "Sign in to your member dashboard" : "Set up your member access"}</p>
        </div>
      </div>
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
        {mode === "signin" ? "New here? Create a member account" : "Already have an account? Sign in"}
      </button>
    </AuthSplit>
  );
}
