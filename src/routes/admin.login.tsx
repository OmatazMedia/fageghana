import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — FAGE Ghana" }] }),
  component: AdminLogin,
});

const REMEMBER_KEY = "fage_admin_email";

function AdminLogin() {
  const { signIn, user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate({ to: "/admin" });
  }, [loading, user, isAdmin, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    if (remember) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }

    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Welcome back");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-dark/95 to-primary/80 flex items-center justify-center px-4 py-12">

      {/* Back to site */}
      <button
        type="button"
        onClick={() => navigate({ to: "/" })}
        className="fixed top-6 left-6 flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors z-50 cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to site
      </button>

      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-0 rounded-3xl overflow-hidden shadow-2xl">

        {/* ── Left panel ── */}
        <div className="relative flex flex-col items-center justify-center bg-primary/20 backdrop-blur-sm border border-white/10 p-10 text-white text-center hidden lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-l-3xl" />

          <img
            src="/images/logos/fage-logo-white.webp"
            alt="FAGE Logo"
            className="h-16 w-auto object-contain mb-8"
          />

          <h2 className="text-3xl font-bold leading-tight">
            Admin Console
          </h2>
          <p className="mt-3 text-white/70 text-sm max-w-xs leading-relaxed">
            Manage members, payments, certificates, content and support — all in one place.
          </p>

          <div className="mt-10 w-full space-y-3 text-left">
            {[
              "Approve membership applications",
              "Confirm payments & subscriptions",
              "Issue membership certificates",
              "Broadcast notifications to members",
              "Manage forms, media & content",
              "Resolve support tickets",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col items-center justify-center bg-background px-8 py-12">

          {/* Logo — mobile only */}
          <img
            src="/images/logos/fage-logo-main.webp"
            alt="FAGE Logo"
            className="h-12 w-auto object-contain mb-6 lg:hidden"
          />

          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your admin account</p>
          </div>

          {/* No-access warning */}
          {user && !isAdmin && (
            <div className="w-full mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive text-center">
              You're signed in but don't have admin access. Contact an existing admin.
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="w-full space-y-5">

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@fageghana.com"
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Link
                  to="/reset-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember email */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-5 w-5 rounded border border-input bg-background peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
                  {remember && (
                    <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground">Remember my email</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in to Admin"}
            </button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground text-center">
            Restricted area — authorised personnel only.
          </p>
        </div>
      </div>
    </div>
  );
}
