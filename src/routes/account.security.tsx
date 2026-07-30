import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Mail, Smartphone, ShieldCheck, ShieldOff, Loader2, Copy, Check, ChevronRight, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { listMyActivity } from "@/lib/activity.functions";
import { ActiveSessionsCard } from "@/components/account/ActiveSessionsCard";


export const Route = createFileRoute("/account/security")({
  head: () => ({ meta: [{ title: "Account & Security" }] }),
  component: SecurityPage,
});

export function SecurityPage({ passwordHref = "/account/change-password" }: { passwordHref?: string } = {}) {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Account & Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your email address and two-factor authentication. Password changes have their own page.
        </p>
      </div>
      <PasswordLinkCard href={passwordHref} />
      <EmailCard currentEmail={user?.email ?? ""} />
      <MfaCard />
      <ActiveSessionsCard />
      <MyActivityCard />

    </div>
  );
}

function MyActivityCard() {
  const fetcher = useServerFn(listMyActivity);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetcher({ data: { limit: 20 } })
      .then((r: any) => setRows(r ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <Card icon={Activity} title="My recent activity" desc="Last 20 sign-ins and account events logged for your user.">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                {r.event_type}
              </span>
              <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              {r.ip_address && <span className="text-muted-foreground">· {r.ip_address}</span>}
              {r.detail && <span className="text-muted-foreground truncate">· {r.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─────────── Password (link to dedicated page) ─────────── */
function PasswordLinkCard({ href }: { href: string }) {
  return (
    <Card icon={KeyRound} title="Password" desc="Change the password you use to sign in.">
      <Link
        to={href as any}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Change password <ChevronRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}

/* ─────────── Email ─────────── */
function EmailCard({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || email === currentEmail) return toast.error("Enter a new email address");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Confirmation sent. Check both your old and new inboxes.");
    setEmail("");
  }

  return (
    <Card icon={Mail} title="Change email" desc={`Current: ${currentEmail}. You'll need to confirm the change via email.`}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="New email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <button
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Sending…" : "Send confirmation email"}
        </button>
      </form>
    </Card>
  );
}

/* ─────────── MFA (TOTP) ─────────── */
type Factor = { id: string; friendly_name?: string | null; factor_type: string; status: string };

function MfaCard() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrSvg: string;
    secret: string;
    name: string;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return toast.error(error.message);
    const all = [...(data?.totp ?? [])] as Factor[];
    setFactors(all);
  }

  useEffect(() => {
    void load();
  }, []);

  async function startEnroll() {
    setEnrolling(true);
    const friendlyName = `Authenticator ${new Date().toLocaleDateString()}`;
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });
    setEnrolling(false);
    if (error) return toast.error(error.message);
    if (!data) return;
    setEnrollment({
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      secret: data.totp.secret,
      name: friendlyName,
    });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;
    if (code.length !== 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
    if (chErr || !ch) {
      setBusy(false);
      return toast.error(chErr?.message ?? "Challenge failed");
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: ch.id,
      code,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication enabled");
    setEnrollment(null);
    setCode("");
    void load();
  }

  async function cancelEnroll() {
    if (!enrollment) return;
    await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    setEnrollment(null);
    setCode("");
  }

  async function disable(factorId: string) {
    if (!confirm("Disable two-factor authentication? This makes your account less secure.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) return toast.error(error.message);
    toast.success("Two-factor authentication disabled");
    void load();
  }

  const verified = factors.filter((f) => f.status === "verified");
  const hasMfa = verified.length > 0;

  return (
    <Card
      icon={hasMfa ? ShieldCheck : Smartphone}
      title="Two-factor authentication"
      desc="Add a second step at sign-in using an authenticator app (Google Authenticator, 1Password, Authy, etc.)."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : enrollment ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">1. Scan this QR code with your authenticator app</p>
            <div
              className="mt-3 inline-block rounded-md bg-white p-3"
              dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Can't scan? Enter this key manually:
            </p>
            <SecretRow secret={enrollment.secret} />
          </div>
          <form onSubmit={verifyEnroll} className="space-y-3">
            <p className="text-sm font-medium">2. Enter the 6-digit code from your app</p>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-40 rounded-lg border border-input bg-background px-3 py-2 text-center font-mono text-lg tracking-widest"
            />
            <div className="flex gap-2">
              <button
                disabled={busy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Verifying…" : "Verify & enable"}
              </button>
              <button
                type="button"
                onClick={cancelEnroll}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : hasMfa ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <ShieldCheck className="h-4 w-4" /> Two-factor authentication is enabled.
          </div>
          {verified.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
            >
              <div>
                <div className="text-sm font-medium">{f.friendly_name || "Authenticator app"}</div>
                <div className="text-xs text-muted-foreground">TOTP · {f.status}</div>
              </div>
              <button
                onClick={() => disable(f.id)}
                className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/5"
              >
                <ShieldOff className="h-3.5 w-3.5" /> Disable
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You currently have no second-factor enabled. Enabling 2FA significantly reduces the risk
            of account takeover.
          </p>
          <button
            onClick={startEnroll}
            disabled={enrolling}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enrolling ? "Starting…" : "Enable two-factor authentication"}
          </button>
        </div>
      )}
    </Card>
  );
}

function SecretRow({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-xs">{secret}</code>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(secret);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="rounded-md border border-border bg-background p-2 hover:bg-accent"
        aria-label="Copy secret"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* ─────────── shared atoms ─────────── */
function Card({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
