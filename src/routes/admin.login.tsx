import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowLeft, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { MfaChallengeDialog, getRequiredMfaChallenge, type MfaChallenge } from "@/components/auth/MfaChallengeDialog";
import { sanitizeEmail } from "@/lib/login-security.shared";
import {
  getLoginGate,
  checkAdminEmail,
  recordPasswordOutcome,
  requestAdminPasswordReset,
} from "@/lib/login-security.functions";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Admin Login — FAGE Ghana" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: AdminLogin,
});

const REMEMBER_KEY = "fage_admin_email";

function readRemembered(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

function AdminLogin() {
  const { signIn, signOut, user, isAdmin, hasAnyRole, loading, roleChecked } = useAuth();
  const navigate = useNavigate();

  const gateFn = useServerFn(getLoginGate);
  const checkEmailFn = useServerFn(checkAdminEmail);
  const recordOutcomeFn = useServerFn(recordPasswordOutcome);
  const resetFn = useServerFn(requestAdminPasswordReset);

  // Any non-member role may log in here.
  const canAccessConsole =
    isAdmin || hasAnyRole(["staff", "finance", "ceo", "developer", "coordinator"]);

  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Hydrate remembered email client-side only (localStorage is not available during SSR).
  useEffect(() => {
    const saved = readRemembered();
    if (saved) {
      setEmail(saved);
      setRemember(true);
    }
  }, []);

  // Banned networks never see the form — straight to the homepage.
  useEffect(() => {
    let alive = true;
    gateFn({})
      .then((s: any) => {
        if (!alive) return;
        if (s?.banned) {
          setBlocked(true);
          navigate({ to: "/", replace: true });
          return;
        }
        if (s?.message) setWarning(s.message);
        setGateChecked(true);
      })
      .catch(() => alive && setGateChecked(true));
    return () => {
      alive = false;
    };
  }, [gateFn, navigate]);

  useEffect(() => {
    if (loading || !roleChecked || mfaChallenge) return;
    if (user && canAccessConsole) navigate({ to: "/admin" });
  }, [loading, roleChecked, user, canAccessConsole, navigate, mfaChallenge]);

  // If a pure member (no console role) signs in here, sign them out and warn.
  useEffect(() => {
    if (loading || !roleChecked || busy || mfaChallenge) return;
    if (user && !canAccessConsole) {
      toast.error("This account is not authorised to access the admin dashboard.");
      void signOut("wrong_portal", "");
    }
  }, [loading, roleChecked, busy, mfaChallenge, user, canAccessConsole, signOut]);

  function applyStatus(status: any) {
    if (status?.banned) {
      setBlocked(true);
      navigate({ to: "/", replace: true });
      return true;
    }
    setWarning(status?.message ?? null);
    return false;
  }

  /* ── Step 1: verify the email belongs to a console account ── */
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clean = sanitizeEmail(email);
    if (!clean.ok) return setFormError(clean.error ?? "Enter a valid email address.");

    setBusy(true);
    try {
      const res: any = await checkEmailFn({ data: { email: clean.email } });
      if (applyStatus(res?.status)) return;
      if (!res?.ok) {
        setFormError(res?.error ?? "This email is not recognised for admin access.");
        return;
      }
      setEmail(clean.email);
      if (remember) {
        try {
          localStorage.setItem(REMEMBER_KEY, clean.email);
        } catch {
          /* storage blocked */
        }
      } else {
        try {
          localStorage.removeItem(REMEMBER_KEY);
        } catch {
          /* storage blocked */
        }
      }
      setStep("password");
    } catch {
      setFormError("Could not verify that email right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  /* ── Step 2: password ── */
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) {
      try {
        const status: any = await recordOutcomeFn({ data: { email, success: false } });
        if (applyStatus(status)) return;
      } catch {
        /* noop */
      }
      setBusy(false);
      setFormError(error);
      return;
    }
    try {
      await recordOutcomeFn({ data: { email, success: true } });
    } catch {
      /* noop */
    }
    const challenge = await getRequiredMfaChallenge();
    setBusy(false);
    if (challenge) {
      setMfaChallenge(challenge);
      return;
    }
    toast.success("Welcome back");
  }

  /* ── Forgot password ── */
  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clean = sanitizeEmail(email);
    if (!clean.ok) return setFormError(clean.error ?? "Enter a valid email address.");
    setBusy(true);
    try {
      const res: any = await resetFn({
        data: { email: clean.email, redirectTo: `${window.location.origin}/reset-password` },
      });
      if (applyStatus(res?.status)) return;
      if (!res?.ok) {
        setFormError(res?.error ?? "Could not send a reset link.");
        return;
      }
      setResetSent(true);
    } catch {
      setFormError("Could not send a reset link right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  if (blocked) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-dark via-brand-dark/95 to-primary/80 flex items-center justify-center px-4 py-12">
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
        <div className="relative flex-col items-center justify-center bg-primary/20 backdrop-blur-sm border border-white/10 p-10 text-white text-center hidden lg:flex">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-l-3xl" />
          <img
            src="/images/logos/fage-logo-white.webp"
            alt="FAGE Logo"
            className="h-16 w-auto object-contain mb-8"
          />
          <h2 className="text-3xl font-bold leading-tight">Admin Console</h2>
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
          <img
            src="/images/logos/fage-logo-main.webp"
            alt="FAGE Logo"
            className="h-12 w-auto object-contain mb-6 lg:hidden"
          />

          <div className="flex flex-col items-center text-center mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {resetMode ? "Reset your password" : "Welcome back"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {resetMode
                ? "We'll email a reset link to your admin address"
                : step === "email"
                  ? "Enter your admin email to continue"
                  : "Enter your password to sign in"}
            </p>
          </div>

          {user && roleChecked && !canAccessConsole && !busy && (
            <div className="w-full mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive text-center">
              This account is not authorised to access the admin dashboard. Members should sign in at
              the member portal.
            </div>
          )}

          {warning && (
            <div className="w-full mb-5 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {formError && (
            <div className="w-full mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {formError}
            </div>
          )}

          {/* ── Reset flow ── */}
          {resetMode ? (
            resetSent ? (
              <div className="w-full space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  A reset link is on its way to <strong className="text-foreground">{email}</strong>. It
                  expires in 60 minutes.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetMode(false);
                    setResetSent(false);
                  }}
                  className="text-sm text-primary cursor-pointer"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={submitReset} className="w-full space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Admin email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      maxLength={254}
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@fageghana.com"
                      className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-60"
                >
                  {busy ? "Checking…" : "Send reset link"}
                </button>
                <button
                  type="button"
                  onClick={() => setResetMode(false)}
                  className="w-full text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Back to sign in
                </button>
              </form>
            )
          ) : step === "email" ? (
            /* ── Step 1: email ── */
            <form onSubmit={submitEmail} className="w-full space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@fageghana.com"
                    className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

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

              <button
                type="submit"
                disabled={busy || !gateChecked}
                className="w-full flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-60"
              >
                {busy ? "Checking…" : "Continue"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(true);
                  setFormError(null);
                }}
                className="w-full text-xs text-primary cursor-pointer"
              >
                Forgot password?
              </button>
            </form>
          ) : (
            /* ── Step 2: password ── */
            <form onSubmit={submitPassword} className="w-full space-y-5">
              <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center justify-between gap-3">
                <span className="text-sm text-foreground truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setPassword("");
                    setFormError(null);
                  }}
                  className="text-xs text-primary shrink-0 cursor-pointer"
                >
                  Use a different email
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetMode(true);
                      setFormError(null);
                    }}
                    className="text-xs text-primary cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoFocus
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

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in to Admin"}
              </button>
            </form>
          )}

          <p className="mt-8 text-xs text-muted-foreground text-center">
            Restricted area — authorised personnel only. Sign-in attempts are logged.
          </p>
        </div>
      </div>

      {mfaChallenge && (
        <MfaChallengeDialog
          challenge={mfaChallenge}
          onSuccess={() => {
            setMfaChallenge(null);
            toast.success("Welcome back");
            navigate({ to: "/admin" });
          }}
          onCancel={async () => {
            await supabase.auth.signOut();
            setMfaChallenge(null);
          }}
        />
      )}
    </div>
  );
}
