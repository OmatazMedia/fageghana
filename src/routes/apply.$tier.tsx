import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { CreditCard, Banknote, Download, ShieldCheck, ArrowLeft, FileText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { DynamicForm, type FormField } from "@/components/forms/DynamicForm";
import { initPaystack, initHubtel } from "@/lib/payments.functions";

export const Route = createFileRoute("/apply/$tier")({
  head: () => ({ meta: [{ title: "Apply for Membership — FAGE Ghana" }] }),
  component: ApplyPage,
});

function ApplyPage() {
  const { tier } = Route.useParams();
  const tierKey = tier as "associate" | "standard" | "corporate";
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [gateways, setGateways] = useState<any[]>([]);
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);
  const [pendingPayment, setPendingPayment] = useState<any | null>(null);
  const [formSchema, setFormSchema] = useState<FormField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"loading"|"choose"|"form"|"manual">("loading");
  const initPaystackFn = useServerFn(initPaystack);
  const initHubtelFn = useServerFn(initHubtel);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: p }, { data: g }, { data: pays }, { data: form }] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("tier", tierKey).maybeSingle(),
      supabase.from("payment_gateways").select("*").eq("enabled", true).order("display_order"),
      supabase.from("payment_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("application_forms").select("schema").eq("tier", tierKey).maybeSingle(),
    ]);
    setPlan(p); setGateways(g ?? []); setFormSchema((form?.schema as any) ?? []);
    const confirmed = (pays ?? []).find(p => p.status === "confirmed");
    const pending = (pays ?? []).find(p => p.status === "pending");
    setConfirmedPayment(confirmed ?? null);
    setPendingPayment(pending ?? null);
    if (confirmed) {
      // Already paid → check for prior submission
      const { data: sub } = await supabase.from("application_submissions").select("id").eq("user_id", user.id).eq("tier", tierKey).maybeSingle();
      if (sub) { toast.success("You've already submitted this application."); navigate({ to: "/dashboard" }); return; }
      setStep("form");
    } else { setStep("choose"); }
  }, [user, tierKey, navigate]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    else if (user) void load();
  }, [user, loading, load, navigate]);

  if (loading || step === "loading" || !plan) return <SiteLayout><div className="py-32 text-center text-muted-foreground">Loading…</div></SiteLayout>;

  async function payOnline(g: any) {
    if (!user) return;
    setBusy(true);
    // Stub: in production this would init Paystack/Hubtel checkout. We simulate confirmation.
    const ok = confirm(`Simulate successful payment of ${plan.currency} ${plan.amount} via ${g.name}?`);
    if (!ok) { setBusy(false); return; }
    const { data, error } = await supabase.from("payment_submissions").insert({
      user_id: user.id, gateway_id: g.id, method: g.provider, amount: plan.amount, currency: plan.currency,
      duration_months: plan.duration_months, status: "confirmed", reference: `STUB-${Date.now()}`, confirmed_at: new Date().toISOString(),
    }).select("*").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setConfirmedPayment(data);
    setStep("form");
    toast.success("Payment confirmed. Please complete your application.");
  }

  async function submitManual(g: any, file: File | null, message: string) {
    if (!user) return;
    setBusy(true);
    let proofUrl: string | null = null;
    if (file) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
      if (upErr) { setBusy(false); return toast.error(upErr.message); }
      proofUrl = path;
    }
    const { error } = await supabase.from("payment_submissions").insert({
      user_id: user.id, gateway_id: g.id, method: g.provider, amount: plan.amount, currency: plan.currency,
      duration_months: plan.duration_months, status: "pending", member_message: message, proof_url: proofUrl,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted! Admin will verify and create your account.");
    navigate({ to: "/dashboard" });
  }

  async function submitForm(answers: Record<string, any>) {
    if (!user || !confirmedPayment) return;
    setBusy(true);
    const { error } = await supabase.from("application_submissions").insert({
      user_id: user.id, tier: tierKey, payment_id: confirmedPayment.id, answers, status: "new",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Application submitted! Admin will approve and issue your certificate.");
    navigate({ to: "/dashboard" });
  }

  function downloadForm() {
    if (!plan.application_form_pdf_url) return toast.error("No form available yet.");
    window.open(plan.application_form_pdf_url, "_blank");
    toast.message("Form downloaded", { description: plan.post_download_message ?? "", duration: 12000 });
  }

  return (
    <SiteLayout>
      <section className="border-b border-border bg-muted/30 py-8">
        <div className="mx-auto max-w-4xl px-4">
          <Link to="/membership" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-3 w-3" /> Back to membership</Link>
          <h1 className="mt-2 text-3xl font-bold capitalize">Apply as {tier}</h1>
          <p className="mt-1 text-muted-foreground">{plan.currency} {Number(plan.amount).toLocaleString()} · {plan.duration_months} months</p>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-4xl px-4">
          {step === "form" && formSchema && (
            <div className="rounded-2xl border border-emerald-200 bg-card p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3 w-3" /> Payment confirmed</div>
              <h2 className="mb-6 text-2xl font-bold">Complete your application</h2>
              {formSchema.length === 0 ? <p className="text-muted-foreground">No form configured yet. Admin will reach out.</p> : (
                <DynamicForm schema={formSchema} onSubmit={submitForm} busy={busy} />
              )}
            </div>
          )}

          {step === "manual" && (
            <ManualBankPanel plan={plan} gateways={gateways.filter(g => g.provider === "manual_bank")} onSubmit={submitManual} onBack={() => setStep("choose")} onDownload={downloadForm} busy={busy} pendingPayment={pendingPayment} />
          )}

          {step === "choose" && (
            <div className="space-y-6">
              {pendingPayment && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  We've received your payment proof. Once admin verifies it, your account will be activated and you'll be able to complete the application.
                </div>
              )}
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-2 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-bold">Need the printable form?</h3></div>
                <p className="mb-3 text-sm text-muted-foreground">Download the official membership form to complete by hand.</p>
                <button onClick={downloadForm} className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><Download className="h-4 w-4" /> Download form (PDF)</button>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-bold">Choose how to pay</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {gateways.filter(g => g.provider !== "manual_bank").map(g => (
                    <button key={g.id} disabled={busy} onClick={() => payOnline(g)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-semibold">{g.name}</div>
                        <div className="text-xs capitalize text-muted-foreground">Pay online via {g.provider}</div>
                      </div>
                    </button>
                  ))}
                  {gateways.some(g => g.provider === "manual_bank") && (
                    <button onClick={() => setStep("manual")} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary">
                      <Banknote className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-semibold">Manual bank deposit</div>
                        <div className="text-xs text-muted-foreground">Pay into a FAGE bank account, then upload proof.</div>
                      </div>
                    </button>
                  )}
                  {gateways.length === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground md:col-span-2">No payment methods configured yet. Please contact admin.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function ManualBankPanel({ plan, gateways, onSubmit, onBack, onDownload, busy, pendingPayment }: any) {
  const [selected, setSelected] = useState<any>(gateways[0] ?? null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  if (gateways.length === 0) return <p>No bank accounts configured.</p>;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-muted-foreground hover:text-primary">← Choose another method</button>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 text-lg font-bold">Step 1 — Download & complete the form</h3>
        <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><Download className="h-4 w-4" /> Download form (PDF)</button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 text-lg font-bold">Step 2 — Pay {plan.currency} {Number(plan.amount).toLocaleString()} into a FAGE bank account</h3>
        {gateways.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {gateways.map((g: any) => <button key={g.id} onClick={() => setSelected(g)} className={`rounded-full px-3 py-1 text-xs ${selected?.id === g.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{g.bank_details?.bank ?? g.name}</button>)}
          </div>
        )}
        {selected && (
          <dl className="grid grid-cols-1 gap-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Bank</dt><dd className="font-medium">{selected.bank_details?.bank}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Account name</dt><dd className="font-medium">{selected.bank_details?.account_name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Account number</dt><dd className="font-mono font-medium">{selected.bank_details?.account_number}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Branch</dt><dd className="font-medium">{selected.bank_details?.branch}</dd></div>
          </dl>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 text-lg font-bold">Step 3 — Send the form & proof to <span className="text-primary">{plan.bank_deposit_email}</span></h3>
        <p className="mb-3 text-sm text-muted-foreground">Email the completed form together with proof of payment. You can also upload your proof here so admin can verify faster.</p>
        <form onSubmit={(e) => { e.preventDefault(); if (!selected) return; onSubmit(selected, file, message); }} className="space-y-3">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Reference / message (optional)" rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={busy || !!pendingPayment} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pendingPayment ? "Awaiting verification" : busy ? "Submitting…" : "Submit proof of payment"}</button>
        </form>
      </div>
    </div>
  );
}
