import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Member Login — FAGE Ghana" }] }),
  component: MemberLogin,
});

function FloatField({
  id, type, value, onChange, placeholder, icon: Icon, suffix, error, cardFocused,
}: {
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ElementType;
  suffix?: React.ReactNode;
  error?: boolean;
  cardFocused?: boolean;
}) {
  const filled = value.length > 0;
  return (
    <div className={`relative flex items-center ${error ? "field-shake" : ""}`}>
      <span
        className={[
          "pointer-events-none absolute flex items-center justify-center transition-all duration-300",
          filled
            ? `left-3 top-1/2 -translate-y-1/2 ${error ? "text-red-400" : "text-primary"}`
            : `left-3 top-1/2 -translate-y-1/2 ${error ? "text-red-400" : cardFocused ? "text-muted-foreground" : "text-white/60"}`,
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
        className={[
          "w-full rounded-xl border py-3 text-sm transition-all duration-200",
          "focus:outline-none focus:ring-2",
          filled ? "pl-8 pr-10" : "pl-10 pr-10",
          error
            ? "bg-white/20 border-red-400 focus:ring-red-400/40 text-white placeholder:text-red-300"
            : cardFocused
            ? "bg-white border-input focus:ring-ring text-foreground placeholder:text-muted-foreground"
            : "bg-white/10 border-white/30 focus:ring-white/40 text-white placeholder:text-white/50",
        ].join(" ")}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>
      )}
    </div>
  );
}

function MemberLogin() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [cardFocused, setCardFocused] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return toast.error(error);
    }
    toast.success("Welcome back!");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{ backgroundImage: `url('/images/products/showcase/04-vegetables.jpeg')` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-black/70" />

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="mb-6 text-center">
          <Link to="/" className="text-sm text-white/80 hover:text-white transition-colors">
            ← Back to FAGE Ghana
          </Link>
        </div>

        <div
          className={`rounded-2xl border shadow-2xl px-8 py-10 transition-all duration-300 ${
            cardFocused
              ? "bg-white/60 border-white/40 backdrop-blur-none"
              : "bg-white/10 border-white/20 backdrop-blur-md"
          }`}
          onFocusCapture={() => setCardFocused(true)}
          onBlurCapture={() => setCardFocused(false)}
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Lock className="h-7 w-7 text-primary-foreground" />
            </div>
            <p className={`text-xs font-semibold tracking-widest uppercase mb-1 transition-colors duration-300 ${cardFocused ? "text-primary" : "text-white/80"}`}>
              FAGE Member Portal
            </p>
            <h1 className={`text-2xl font-bold transition-colors duration-300 ${cardFocused ? "text-foreground" : "text-white"}`}>
              Welcome back
            </h1>
            <p className={`mt-1 text-sm transition-colors duration-300 ${cardFocused ? "text-muted-foreground" : "text-white/70"}`}>
              Sign in to your member dashboard
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className={`mb-1.5 block text-sm font-medium transition-colors duration-300 ${cardFocused ? "text-foreground" : "text-white/90"}`}>
                Email address
              </label>
              <FloatField
                id="email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Enter your email"
                icon={Mail}
                error={shake}
                cardFocused={cardFocused}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className={`text-sm font-medium transition-colors duration-300 ${cardFocused ? "text-foreground" : "text-white/90"}`}>
                  Password
                </label>
                <Link
                  to="/reset-password"
                  className={`text-xs transition-colors duration-300 ${cardFocused ? "text-primary hover:underline" : "text-white/70 hover:text-white"}`}
                >
                  Forgot password?
                </Link>
              </div>
              <FloatField
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Enter your password"
                icon={Lock}
                error={shake}
                cardFocused={cardFocused}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className={`transition-colors ${cardFocused ? "text-muted-foreground hover:text-foreground" : "text-white/60 hover:text-white"}`}
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className={`text-sm transition-colors duration-300 ${cardFocused ? "text-muted-foreground" : "text-white/70"}`}>
              New here?{" "}
              <Link
                to="/membership"
                className={`font-semibold transition-colors duration-300 ${cardFocused ? "text-primary hover:underline" : "text-white underline underline-offset-2 hover:text-white/80"}`}
              >
                Create a member account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} Federation of Associations of Ghanaian Exporters
        </p>
      </div>
    </div>
  );
}
