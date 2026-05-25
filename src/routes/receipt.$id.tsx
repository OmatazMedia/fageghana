import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/receipt/$id")({
  head: () => ({ meta: [{ title: "Payment Receipt — FAGE Ghana" }] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: sub }, { data: prof }] = await Promise.all([
        supabase
          .from("payment_submissions")
          .select("*, payment_gateways(name,provider)")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("member_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!sub || sub.status !== "confirmed") {
        setMissing(true);
        setBusy(false);
        return;
      }
      setData(sub);
      setProfile(prof);
      setBusy(false);
    })();
  }, [user, id]);

  if (loading || busy) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (missing || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Receipt unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This payment isn't confirmed yet, or the receipt isn't accessible to your account.
        </p>
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </button>
      </div>
    );
  }

  const created = new Date(data.confirmed_at ?? data.created_at);
  const expiry = profile?.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const tier = data.member_message?.match(/tier:([a-z0-9_-]+)/i)?.[1] || profile?.tier || "—";

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="mx-auto max-w-2xl px-4">
        <div className="no-print mb-4 flex items-center justify-between">
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm print:border-0 print:shadow-none">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/logos/fage-logo-main.webp"
                alt="FAGE"
                className="h-10 w-auto"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
              <div>
                <div className="text-lg font-bold">FAGE Ghana</div>
                <div className="text-xs text-muted-foreground">
                  Federation of Associations of Ghanaian Exporters
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Receipt</div>
              <div className="font-mono text-xs">{data.reference || data.id.slice(0, 8)}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <Info label="Member name" value={profile?.contact_name || "—"} />
            <Info label="Member ID" value={profile?.member_id || "Pending"} />
            <Info label="Tier" value={<span className="capitalize">{tier}</span>} />
            <Info label="Email" value={profile?.email || "—"} />
            <Info label="Date paid" value={created.toLocaleString()} />
            <Info label="Payment method" value={data.payment_gateways?.name ?? data.method} />
            <Info
              label="Reference"
              value={<span className="font-mono">{data.reference || "—"}</span>}
            />
            <Info
              label="Status"
              value={
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Confirmed
                </span>
              }
            />
            {expiry && <Info label="New expiry" value={expiry.toLocaleDateString()} />}
            <Info label="Duration" value={`${data.duration_months} months`} />
          </div>

          <div className="mt-6 rounded-xl bg-muted/40 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount paid</span>
              <span className="text-2xl font-bold">
                {data.currency} {Number(data.amount).toLocaleString()}
              </span>
            </div>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            This receipt confirms payment received by FAGE Ghana. Keep it for your records. For
            questions, contact membership@fageghana.org.
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
