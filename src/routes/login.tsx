import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Member Login — FAGE Ghana" }] }),
  component: MemberLogin,
});

const MEMBERSHIP_SLIDES = [
  {
    tier: "Corporate Membership Benefits",
    points: [
      "Access to market information.",
      "Networking and business linkages.",
      "Training programs.",
      "Participation in international trade fairs and export promotion activities.",
      "Support in presentation of challenges to government and development partners.",
    ],
  },
  {
    tier: "Associate Membership Benefits",
    points: [
      "Access to market information.",
      "Networking and business linkages.",
      "Training programs.",
      "Participation in international trade fairs and export promotion activities.",
      "Support in presentation of challenges to government and development partners.",
    ],
  },
  {
    tier: "Standard Membership Benefits",
    points: [
      "Access to market information.",
      "Networking and business linkages.",
      "Training programs.",
      "Participation in international trade fairs and export promotion activities.",
      "Support in presentation of challenges to government and development partners.",
    ],
  },
];

const CHAR_SPEED = 28;
const POINT_PAUSE = 400;
const WIPE_PAUSE = 1800;

function TypingPanel() {
  const [slideIdx, setSlideIdx] = useState(0);
  const [titleText, setTitleText] = useState("");
  const [points, setPoints] = useState<string[]>([]);
  const [currentPoint, setCurrentPoint] = useState("");
  const [visible, setVisible] = useState(true);
  const [done, setDone] = useState(false);
  const [hovered, setHovered] = useState(false);
  const cancelRef = useRef(false);
  const pausedRef = useRef(false);

  // keep pausedRef in sync with hovered
  useEffect(() => { pausedRef.current = hovered; }, [hovered]);

  useEffect(() => {
    cancelRef.current = false;
    setTitleText("");
    setPoints([]);
    setCurrentPoint("");
    setVisible(true);
    setDone(false);

    const slide = MEMBERSHIP_SLIDES[slideIdx];
    let timeout: ReturnType<typeof setTimeout>;

    function wait(ms: number) {
      return new Promise<void>((res) => { timeout = setTimeout(res, ms); });
    }

    // waits until unpaused, checking every 100ms
    async function waitUnpaused() {
      while (pausedRef.current) {
        await new Promise<void>((res) => { timeout = setTimeout(res, 100); });
      }
    }

    async function run() {
      // Type title
      for (let i = 0; i <= slide.tier.length; i++) {
        if (cancelRef.current) return;
        await new Promise<void>((res) => {
          timeout = setTimeout(() => { setTitleText(slide.tier.slice(0, i)); res(); }, CHAR_SPEED);
        });
      }

      // Type each point
      for (let p = 0; p < slide.points.length; p++) {
        if (cancelRef.current) return;
        await wait(POINT_PAUSE);
        const point = slide.points[p];
        for (let i = 0; i <= point.length; i++) {
          if (cancelRef.current) return;
          await new Promise<void>((res) => {
            timeout = setTimeout(() => { setCurrentPoint(point.slice(0, i)); res(); }, CHAR_SPEED);
          });
        }
        if (cancelRef.current) return;
        if (p < slide.points.length - 1) {
          setPoints((prev) => [...prev, point]);
        }
        setCurrentPoint("");
      }

      // All done — show blinking cursor on last point, wait until mouse leaves
      setDone(true);
      setCurrentPoint(slide.points[slide.points.length - 1]);
      await waitUnpaused();
      if (cancelRef.current) return;
      setCurrentPoint("");

      await wait(WIPE_PAUSE);
      if (cancelRef.current) return;
      setVisible(false);
      await wait(600);
      if (cancelRef.current) return;
      setDone(false);
      setSlideIdx((i) => (i + 1) % MEMBERSHIP_SLIDES.length);
    }

    run();
    return () => { cancelRef.current = true; clearTimeout(timeout); };
  }, [slideIdx]);

  return (
    <div
      className={`transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <h2 className="text-3xl font-bold text-white mb-6 min-h-[2rem]">
        {titleText}
        {titleText.length < MEMBERSHIP_SLIDES[slideIdx].tier.length && (
          <span className="animate-pulse">|</span>
        )}
      </h2>
      <ul className="space-y-4">
        {points.map((pt, i) => (
          <li key={i} className="flex items-start gap-3 text-white/90 text-base">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400" />
            <span>{pt}</span>
          </li>
        ))}
        {currentPoint && (
          <li className="flex items-start gap-3 text-white/90 text-base">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-400/50" />
            <span>
              {currentPoint}
              <span className="animate-pulse">|</span>
            </span>
          </li>
        )}
      </ul>
      {done && hovered && (
        <p className="mt-6 text-xs text-white/40 italic">Paused — move mouse away to continue</p>
      )}
    </div>
  );
}

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
            : `left-3 top-1/2 -translate-y-1/2 ${error ? "text-red-400" : cardFocused ? "text-[#0a2e0a]/60" : "text-white/60"}`,
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
            ? "bg-white border-[#0a2e0a]/30 focus:ring-[#0a2e0a]/40 text-[#0a2e0a] placeholder:text-[#0a2e0a]/40"
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
  const { signIn, resetPassword, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [cardFocused, setCardFocused] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);

  function switchMode(next: "login" | "reset") {
    setVisible(false);
    setTimeout(() => { setMode(next); setVisible(true); }, 250);
  }

  async function submitLogin(e: React.FormEvent) {
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

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await resetPassword(resetEmail);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Reset link sent! Check your email.");
    switchMode("login");
  }

  const cf = cardFocused;
  const labelCls = `mb-1.5 block text-base font-medium transition-colors duration-300 ${cf ? "text-[#0a2e0a]" : "text-white/90"}`;

  return (
    <div
      className="min-h-screen flex bg-cover bg-center relative"
      style={{ backgroundImage: `url('/images/products/showcase/04-vegetables.jpeg')` }}
    >
      <div className="absolute inset-0 bg-[#0a2e0a]/90" />

      {/* Left — Login / Reset */}
      <div className="relative z-10 w-full lg:w-1/2 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <Link to="/" className="text-sm text-white/80 hover:text-white transition-colors">
              ← Back to FAGE Ghana
            </Link>
          </div>

          <div
            className={`rounded-2xl border shadow-2xl px-8 py-10 transition-all duration-300 ${
              cf ? "bg-white/50 border-[#0a2e0a]/30 backdrop-blur-none"
                 : "bg-white/5 border-white/15 backdrop-blur-md"
            }`}
            onFocusCapture={() => setCardFocused(true)}
            onBlurCapture={() => setCardFocused(false)}
          >
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
                {mode === "login"
                  ? <Lock className="h-7 w-7 text-primary-foreground" />
                  : <KeyRound className="h-7 w-7 text-primary-foreground" />}
              </div>
              <p className={`text-sm font-semibold tracking-widest uppercase mb-1 transition-colors duration-300 ${cf ? "text-[#0a2e0a]" : "text-white/80"}`}>
                FAGE Member Portal
              </p>
              <h1 className={`text-3xl font-bold transition-colors duration-300 ${cf ? "text-[#0a2e0a]" : "text-white"}`}>
                {mode === "login" ? "Welcome back" : "Reset password"}
              </h1>
              <p className={`mt-1 text-base transition-colors duration-300 ${cf ? "text-[#0a2e0a]/70" : "text-white/70"}`}>
                {mode === "login"
                  ? "Sign in to your member dashboard"
                  : "Enter your email and we'll send a reset link"}
              </p>
            </div>

            {/* Morphing body */}
            <div
              className="transition-all duration-250"
              style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(8px)" }}
            >
              {mode === "login" ? (
                <form onSubmit={submitLogin} className="space-y-4">
                  <div>
                    <label htmlFor="email" className={labelCls}>Email address</label>
                    <FloatField
                      id="email" type="email" value={email} onChange={setEmail}
                      placeholder="Enter your email" icon={Mail} error={shake} cardFocused={cf}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="password" className={`text-base font-medium transition-colors duration-300 ${cf ? "text-[#0a2e0a]" : "text-white/90"}`}>
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => switchMode("reset")}
                        className={`text-sm transition-colors duration-300 ${cf ? "text-[#0a2e0a]/70 hover:text-[#0a2e0a]" : "text-white/70 hover:text-white"}`}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FloatField
                      id="password" type={showPw ? "text" : "password"} value={password} onChange={setPassword}
                      placeholder="Enter your password" icon={Lock} error={shake} cardFocused={cf}
                      suffix={
                        <button type="button" onClick={() => setShowPw((p) => !p)}
                          className={`transition-colors ${cf ? "text-[#0a2e0a]/60 hover:text-[#0a2e0a]" : "text-white/60 hover:text-white"}`}
                          tabIndex={-1} aria-label={showPw ? "Hide password" : "Show password"}
                        >
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      }
                    />
                  </div>
                  <button type="submit" disabled={busy}
                    className="mt-2 w-full rounded-full bg-primary py-3 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                </form>
              ) : (
                <form onSubmit={submitReset} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className={labelCls}>Email address</label>
                    <FloatField
                      id="reset-email" type="email" value={resetEmail} onChange={setResetEmail}
                      placeholder="Enter your email" icon={Mail} cardFocused={cf}
                    />
                  </div>
                  <button type="submit" disabled={busy}
                    className="mt-2 w-full rounded-full bg-primary py-3 text-base font-semibold text-primary-foreground shadow-md hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                  <button type="button" onClick={() => switchMode("login")}
                    className={`flex items-center gap-2 mx-auto text-sm transition-colors duration-300 ${cf ? "text-[#0a2e0a]/70 hover:text-[#0a2e0a]" : "text-white/70 hover:text-white"}`}
                  >
                    <ArrowLeft size={14} /> Back to sign in
                  </button>
                </form>
              )}
            </div>

            {/* Footer link — only on login mode */}
            {mode === "login" && (
              <div className="mt-6 text-center">
                <p className={`text-base transition-colors duration-300 ${cf ? "text-[#0a2e0a]/70" : "text-white/70"}`}>
                  New here?{" "}
                  <Link to="/membership"
                    className={`font-semibold transition-colors duration-300 ${cf ? "text-[#0a2e0a] underline underline-offset-2 hover:text-[#0a2e0a]/70" : "text-white underline underline-offset-2 hover:text-white/80"}`}
                  >
                    Create a member account
                  </Link>
                </p>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-white/60">
            © {new Date().getFullYear()} Federation of Associations of Ghanaian Exporters
          </p>
        </div>
      </div>

      {/* Right — Animated typing benefits */}
      <div className="relative z-10 hidden lg:flex w-1/2 flex-col items-start justify-center px-16">
        <div className="w-full max-w-lg">
          <p className="text-sm font-semibold tracking-widest uppercase text-green-400 mb-4">
            Why join FAGE?
          </p>
          <TypingPanel />
        </div>
      </div>
    </div>
  );
}
