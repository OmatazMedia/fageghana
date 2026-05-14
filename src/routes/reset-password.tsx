import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/auth-member.jpg";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — FAGE Ghana" }] }),
  component: ResetPassword,
});

/** Reusable animated icon-in-field input */
function FloatField({
  id,
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
  suffix,
  autoComplete,
}: {
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ElementType;
  suffix?: React.ReactNode;
  autoComplete?: string;
}) {
  const filled = value.length > 0;
  return (
    <div className="relative flex items-center">
      <span
        className={[
          "pointer-events-none absolute flex items-center justify-center transition-all duration-300",
          filled ? "left-3 top-1/2 -translate-y-1/2 text-primary" : "left-3 top-1/2 -translate-y-1/2 text-muted-foreground",
        ].join(" ")}
        style={{ width: 18, height: 18 }}
      >
        <Icon size={filled ? 15 : 18} className="transition-all duration-300" />
      </span>
      <input
        id={id}
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={filled ? "" : placeholder}
        autoComplete={autoComplete}
        className={[
          "w-full rounded-xl border border-input bg-background py-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-200",
          filled ? "pl-8 pr-10" : "pl-10 pr-10",
        ].join(" ")}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>
      )}
    </div>
  );
}

function ResetPassword() {
  const navigate = useNavigate();

  // "set" mode = arrived via recovery link (session already set by Supabase)
  const [mode, setMode] = useState<"request" | "set" | "sent">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // If Supabase has set a recovery session via the URL hash, switch to "set" mode
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setMode("set");
    });
  }, []);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setMode("sent");
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords do not match.");
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated! Redirecting to your dashboard…");
    setTimeout(() => navigate({ to: "/dashboard" }), 1500);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: `url(${heroImg})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-black/70" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-6 text-center">
          <Link to="/login" className="text-sm text-white/80 hover:text-white transition-colors">
            ← Back to login
          </Link>
        </div>

        <div className="rounded-2xl bg-background/95 backdrop-blur-sm shadow-2xl px-8 py-10">

          {/* ── SENT confirmation ── */}
          {mode === "sent" && (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                <CheckCircle2 className="h-7 w-7 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">Check your inbox</h1>
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to{" "}
                <span className="font-semibold text-foreground">{email}</span>.
                Click the link in the email to set a new password.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't receive it? Check your spam folder or{" "}
                <button
                  onClick={() => setMode("request")}
                  className="text-primary hover:underline font-medium"
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/login"
                className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
              >
                Return to login
              </Link>
            </div>
          )}

          {/* ── REQUEST reset email ── */}
          {mode === "request" && (
            <>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <Mail className="h-7 w-7 text-primary-foreground" />
                </div>
                <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-1">
                  FAGE Member Portal
                </p>
                <h1 className="text-2xl font-bold">Forgot your password?</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={requestReset} className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                    Email address
                  </label>
                  <FloatField
                    id="email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="Enter your email"
                    icon={Mail}
                    autoComplete="email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                  ← Back to login
                </Link>
              </div>
            </>
          )}

          {/* ── SET new password (arrived via recovery link) ── */}
          {mode === "set" && (
            <>
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                  <KeyRound className="h-7 w-7 text-primary-foreground" />
                </div>
                <p className="text-xs font-semibold tracking-widest text-primary uppercase mb-1">
                  FAGE Member Portal
                </p>
                <h1 className="text-2xl font-bold">Set a new password</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={setNewPassword} className="space-y-4">
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                    New password
                  </label>
                  <FloatField
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 8 characters"
                    icon={Lock}
                    autoComplete="new-password"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPw((p) => !p)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showPw ? "Hide password" : "Show password"}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>

                <div>
                  <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
                    Confirm password
                  </label>
                  <FloatField
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="Repeat your password"
                    icon={Lock}
                    autoComplete="new-password"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />
                </div>

                <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                  <li className={password.length >= 8 ? "text-primary" : ""}>
                    {password.length >= 8 ? "✓" : "·"} At least 8 characters
                  </li>
                  <li className={confirm && confirm === password ? "text-primary" : ""}>
                    {confirm && confirm === password ? "✓" : "·"} Passwords match
                  </li>
                </ul>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Update password"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} Federation of Associations of Ghanaian Exporters
        </p>
      </div>
    </div>
  );
}
