import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Loader2,
  LogOut,
  Receipt,
  Upload,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { initRenewalPayment } from "@/lib/payments.functions";
import { openPaystackInline } from "@/lib/paystackInline";
import { openFlutterwaveInline } from "@/lib/flutterwaveInline";

type Plan = {
  id: string;
  tier: string;
  name: string | null;
  description: string | null;
  amount: number;
  currency: string;
  duration_months: number;
  active: boolean;
  display_order: number | null;
};

type Gateway = {
  id: string;
  name: string;
  provider: string;
  bank_details: any;
};

type Submission = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  proof_url: string | null;
  admin_notes: string | null;
  created_at: string;
  gateway_id: string | null;
  method: string;
};

export function RenewalLockScreen({
  reason,
  expiryDate,
  tier,
  userId,
  email,
  onSignOut,
  onActivated,
}: {
  reason: "expired" | "suspended" | "inactive";
  expiryDate: string | null;
  tier: string | null;
  userId: string;
  email: string;
  onSignOut: () => void;
  onActivated: () => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [pendingSubs, setPendingSubs] = useState<Submission[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [openManual, setOpenManual] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initRenew = useServerFn(initRenewalPayment);
  const fileRef = useRef<HTMLInputElement>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [paymentReference, setPaymentReference] = useState("");

  const refresh = useCallback(async () => {
    const [{ data: planRows }, { data: gwRows }, { data: subs }] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("display_order"),
      supabase.from("payment_gateways").select("id,name,provider,bank_details,enabled").eq("enabled", true),
      supabase
        .from("payment_submissions")
        .select("id,reference,amount,currency,status,proof_url,admin_notes,created_at,gateway_id,method")
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setPlans((planRows ?? []) as Plan[]);
    setGateways((gwRows ?? []) as Gateway[]);
    setPendingSubs((subs ?? []) as Submission[]);
    if (!selectedPlanId && planRows && planRows.length > 0) {
      const own = (planRows as Plan[]).find((p) => p.tier === tier);
      setSelectedPlanId((own ?? planRows[0]).id);
    }
  }, [userId, tier, selectedPlanId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Poll for confirmation
  useEffect(() => {
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("member_profiles")
        .select("subscription_expiry,status")
        .eq("user_id", userId)
        .maybeSingle();
      if (
        data?.subscription_expiry &&
        new Date(data.subscription_expiry).getTime() > Date.now() &&
        data?.status !== "suspended"
      ) {
        onActivated();
      }
    }, 8000);
    return () => clearInterval(t);
  }, [userId, onActivated]);

  const onlineGateways = gateways.filter((g) => g.provider !== "manual_bank");
  const manualGateways = gateways.filter((g) => g.provider === "manual_bank");
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  async function payOnline(gatewayId: string) {
    if (!selectedPlanId) return toast.error("Please pick a plan first");
    setBusy(true);
    try {
      const payment = await initRenew({
        data: { plan_id: selectedPlanId, gateway_id: gatewayId },
      });
      if ("mode" in payment && payment.mode === "paystack_inline") {
        await openPaystackInline(payment, () => setBusy(false));
        return;
      }
      if ("mode" in payment && payment.mode === "flutterwave_inline") {
        await openFlutterwaveInline(payment, () => setBusy(false));
        return;
      }
      window.location.href = payment.redirect_url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start payment");
      setBusy(false);
    }
  }

  async function submitManual(gateway: Gateway) {
    if (!selectedPlan) return toast.error("Please pick a plan first");
    if (!proofFile) return toast.error("Please attach a proof of payment file");
    if (!paymentReference.trim())
      return toast.error("Please enter the bank reference / transaction ID");
    setBusy(true);
    try {
      const reference = `MAN-${selectedPlan.tier.toUpperCase()}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
      const { data: sub, error: insErr } = await supabase
        .from("payment_submissions")
        .insert({
          user_id: userId,
          gateway_id: gateway.id,
          method: gateway.provider,
          amount: selectedPlan.amount,
          currency: selectedPlan.currency,
          duration_months: selectedPlan.duration_months,
          status: "pending",
          reference,
          kind: "renew",
          member_message: `tier:${selectedPlan.tier}|renew:${selectedPlan.id}|bank_ref:${paymentReference.trim()}`,
        } as any)
        .select("*")
        .single();
      if (insErr) throw insErr;

      const ext = proofFile.name.split(".").pop() || "bin";
      const path = `${userId}/${reference}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, proofFile, { upsert: true });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("payment_submissions")
        .update({ proof_url: path })
        .eq("id", sub.id);
      if (updErr) throw updErr;

      toast.success("Payment proof submitted. Awaiting admin confirmation.");
      setProofFile(null);
      setPaymentReference("");
      if (fileRef.current) fileRef.current.value = "";
      setOpenManual(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit payment");
    } finally {
      setBusy(false);
    }
  }

  const title =
    reason === "suspended"
      ? "Your membership is suspended"
      : reason === "expired"
        ? "Your membership has expired"
        : "Activate your membership";
  const body =
    reason === "suspended"
      ? "Your account was suspended by an administrator. Renew below or contact support to resolve this."
      : reason === "expired"
        ? `Your ${tier ?? "membership"} subscription expired${expiryDate ? ` on ${new Date(expiryDate).toLocaleDateString()}` : ""}. Renew now to restore full access.`
        : "Pick a plan below to activate your FAGE membership and unlock the full member portal.";

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            <p className="mt-1 text-xs text-muted-foreground">Signed in as {email}</p>
          </div>
          <button
            onClick={onSignOut}
            className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted sm:inline-flex"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {pendingSubs.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <Receipt className="h-4 w-4" /> You have a pending payment
          </div>
          <p className="mt-1 text-xs">
            We're waiting for admin confirmation. Once confirmed your account will reactivate
            automatically.
          </p>
          {pendingSubs.map((s) => (
            <div key={s.id} className="mt-2 rounded-md bg-white/60 p-2 text-xs">
              <span className="font-mono">{s.reference}</span> · {s.currency}{" "}
              {Number(s.amount).toLocaleString()} ·{" "}
              {new Date(s.created_at).toLocaleString()}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-base font-bold">1. Choose your plan</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {plans.length === 0 && (
            <p className="text-sm text-muted-foreground">No plans available.</p>
          )}
          {plans.map((p) => {
            const isCurrent = p.tier === tier;
            const selected = p.id === selectedPlanId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlanId(p.id)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition ${
                  selected ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize">{p.name ?? p.tier}</span>
                  {isCurrent && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      Current
                    </span>
                  )}
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-1 text-lg font-bold">
                  {p.currency} {Number(p.amount).toLocaleString()}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  for {p.duration_months} months
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="text-base font-bold">2. Pay</h3>
        {gateways.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No payment methods have been configured yet. Please contact support.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {onlineGateways.map((g) => (
              <button
                key={g.id}
                disabled={busy || !selectedPlanId}
                onClick={() => payOnline(g.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs capitalize text-muted-foreground">
                      Pay online securely via {g.provider}
                    </div>
                  </div>
                </div>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs font-semibold text-primary">Pay now →</span>
                )}
              </button>
            ))}

            {manualGateways.map((g) => {
              const isOpen = openManual === g.id;
              const bank = (g.bank_details ?? {}) as Record<string, any>;
              return (
                <div key={g.id} className="overflow-hidden rounded-xl border border-border">
                  <button
                    onClick={() => setOpenManual(isOpen ? null : g.id)}
                    className="flex w-full items-center justify-between gap-3 bg-background p-4 text-left hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <Banknote className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-semibold">{g.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Pay by bank transfer / deposit
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                      {isOpen ? "Hide" : "I have made payment"}
                      <ChevronDown
                        className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="space-y-4 border-t border-border bg-muted/30 p-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Bank account details
                        </div>
                        {Object.keys(bank).length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Bank details haven't been set yet — please contact support for transfer
                            instructions.
                          </p>
                        ) : (
                          <dl className="mt-2 grid grid-cols-1 gap-1 rounded-lg bg-background p-3 text-sm sm:grid-cols-2">
                            {Object.entries(bank).map(([k, v]) => (
                              <div key={k}>
                                <dt className="text-xs uppercase text-muted-foreground">
                                  {k.replace(/_/g, " ")}
                                </dt>
                                <dd className="font-medium break-all">{String(v)}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {selectedPlan && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Amount to pay:{" "}
                            <span className="font-semibold text-foreground">
                              {selectedPlan.currency}{" "}
                              {Number(selectedPlan.amount).toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium">
                            Your bank reference / transaction ID
                          </label>
                          <input
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="e.g. TRX12345678"
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium">
                            Proof of payment (PDF or image)
                          </label>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="application/pdf,image/*"
                            onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
                          />
                        </div>
                      </div>
                      {proofFile && (
                        <p className="text-xs text-muted-foreground">
                          <CheckCircle2 className="mr-1 inline h-3 w-3 text-emerald-600" />
                          {proofFile.name} ({Math.round(proofFile.size / 1024)} KB)
                        </p>
                      )}

                      <button
                        onClick={() => submitManual(g)}
                        disabled={busy || !proofFile || !selectedPlanId || !paymentReference.trim()}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Submit payment proof
                      </button>
                      <p className="text-[11px] text-muted-foreground">
                        Admin will review your proof and confirm payment. Your account will
                        reactivate and a receipt will be generated automatically.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <span>
          Need help? Visit your{" "}
          <Link to="/dashboard" search={{ tab: "support" } as any} className="font-semibold text-primary hover:underline">
            Support tab
          </Link>{" "}
          or view past{" "}
          <Link to="/dashboard" search={{ tab: "invoices" } as any} className="font-semibold text-primary hover:underline">
            invoices
          </Link>
          .
        </span>
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
