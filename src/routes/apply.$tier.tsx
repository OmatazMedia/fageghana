import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Banknote, Download, ArrowLeft, FileText, ShieldCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { DynamicForm, type FormField } from "@/components/forms/DynamicForm";
import { initApplicationPayment } from "@/lib/payments.functions";
import { createPendingApplication } from "@/lib/onboarding.functions";
import { downloadFile } from "@/lib/forceDownload";

export const Route = createFileRoute("/apply/$tier")({
  head: () => ({ meta: [{ title: "Apply for Membership — FAGE Ghana" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || "" }),
  component: ApplyPage,
});

function ApplyPage() {
  const { tier } = Route.useParams();
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [gateways, setGateways] = useState<any[]>([]);
  const [formSchema, setFormSchema] = useState<FormField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<any | null>(null);
  const [step, setStep] = useState<"loading" | "contact" | "pay" | "manual" | "form">("loading");
  const [contact, setContact] = useState({ full_name: "", email: "", phone: "", company_name: "" });
  const initPay = useServerFn(initApplicationPayment);
  const createPending = useServerFn(createPendingApplication);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: g }, { data: form }] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("tier", tier as any).eq("active", true).maybeSingle(),
        supabase.from("payment_gateways").select("*").eq("enabled", true).order("display_order"),
        supabase.from("application_forms").select("schema").eq("tier", tier as any).maybeSingle(),
      ]);
      setPlan(p); setGateways(g ?? []); setFormSchema((form?.schema as any) ?? []);

      if (token) {
        // Returning from payment with claim token — load pending + check submission
        const { data: pa } = await supabase.from("pending_applications").select("*").eq("claim_token", token).maybeSingle();
        if (pa) {
          setPending(pa);
          if (pa.status === "paid" || pa.status === "claimed") { setStep("form"); return; }
        }
      }
      setStep("contact");
    })();
  }, [tier, token]);

  if (step === "loading" || !plan) return <SiteLayout><div className="py-32 text-center text-muted-foreground">Loading…</div></SiteLayout>;

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contact.full_name || !contact.email || !contact.phone) return toast.error("All starred fields are required");
    setBusy(true);
    try {
      const res = await createPending({ data: { plan_id: plan.id, ...contact } });
      setPending({ id: res.id, claim_token: res.claim_token, tier: res.tier });
      setStep("pay");
    } catch (e: any) { toast.error(e?.message ?? "Could not save details"); }
    finally { setBusy(false); }
  }

  async function payOnline(g: any) {
    if (!pending) return toast.error("Missing application");
    setBusy(true);
    try {
      const { redirect_url } = await initPay({ data: { pending_application_id: pending.id, gateway_id: g.id } });
      window.location.href = redirect_url;
    } catch (e: any) { toast.error(e?.message ?? "Could not start payment"); setBusy(false); }
  }

  async function submitForm(answers: Record<string, any>) {
    if (!pending) return;
    setBusy(true);
    // Sign-in required to write into application_submissions (RLS). If not signed-in, ask the user to use the magic link sent to their email.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return toast.error("Please sign in via the link sent to your email to submit the form."); }
    const { error } = await supabase.from("application_submissions").insert({
      user_id: user.id, tier: pending.tier as any, answers, status: "new" as any,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await supabase.from("pending_applications").update({ status: "claimed" } as any).eq("id", pending.id);
    toast.success("Application submitted!");
    navigate({ to: "/dashboard" });
  }

  async function downloadPdf() {
    if (!plan.application_form_pdf_url) return toast.error("No form PDF available yet.");
    await downloadFile(plan.application_form_pdf_url, `FAGE-${tier}-application.pdf`);
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
        <div className="mx-auto max-w-4xl px-4 space-y-6">
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {["Your details", "Payment", "Application form"].map((label, i) => {
              const active = (step === "contact" && i === 0) || ((step === "pay" || step === "manual") && i === 1) || (step === "form" && i === 2);
              return <li key={label} className={`rounded-full px-3 py-1 ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}. {label}</li>;
            })}
          </ol>

          {step === "contact" && (
            <form onSubmit={submitContact} className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold">Tell us who you are</h2>
              <p className="text-sm text-muted-foreground">We'll create your account automatically once your payment is confirmed.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Full name *" value={contact.full_name} onChange={(v) => setContact(c => ({ ...c, full_name: v }))} />
                <Input label="Work email *" type="email" value={contact.email} onChange={(v) => setContact(c => ({ ...c, email: v }))} />
                <Input label="Phone *" value={contact.phone} onChange={(v) => setContact(c => ({ ...c, phone: v }))} />
                <Input label="Company name" value={contact.company_name} onChange={(v) => setContact(c => ({ ...c, company_name: v }))} />
              </div>
              <button disabled={busy} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Continue to payment"}</button>
            </form>
          )}

          {step === "pay" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-3 text-lg font-bold">Choose how to pay</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {gateways.filter(g => g.provider !== "manual_bank").map(g => (
                    <button key={g.id} disabled={busy} onClick={() => payOnline(g)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <div><div className="font-semibold">{g.name}</div><div className="text-xs capitalize text-muted-foreground">Pay online via {g.provider}</div></div>
                    </button>
                  ))}
                  {gateways.some(g => g.provider === "manual_bank") && (
                    <button onClick={() => setStep("manual")} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary">
                      <Banknote className="h-5 w-5 text-primary" />
                      <div><div className="font-semibold">Manual bank deposit</div><div className="text-xs text-muted-foreground">Pay into a FAGE bank account, then upload proof.</div></div>
                    </button>
                  )}
                  {gateways.length === 0 && <p className="text-sm text-muted-foreground md:col-span-2">No payment methods configured yet. Please contact admin.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-2 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /><h3 className="text-lg font-bold">Need the printable form?</h3></div>
                <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><Download className="h-4 w-4" /> Download form (PDF)</button>
              </div>
            </div>
          )}

          {step === "manual" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
              <button onClick={() => setStep("pay")} className="text-sm text-muted-foreground hover:text-primary">← Choose another method</button>
              <h3 className="text-lg font-bold">Manual bank deposit</h3>
              {gateways.filter(g => g.provider === "manual_bank").map((g: any) => (
                <dl key={g.id} className="rounded-lg bg-muted/40 p-4 text-sm">
                  <div className="font-semibold">{g.bank_details?.bank ?? g.name}</div>
                  {g.bank_details?.account_name && <div>Account: {g.bank_details.account_name}</div>}
                  {g.bank_details?.account_number && <div className="font-mono">No: {g.bank_details.account_number}</div>}
                  {g.bank_details?.branch && <div>Branch: {g.bank_details.branch}</div>}
                </dl>
              ))}
              <p className="text-sm text-muted-foreground">After paying, email proof to <a href={`mailto:${plan.bank_deposit_email}`} className="text-primary underline">{plan.bank_deposit_email}</a>. Admin will verify and your account will be created.</p>
            </div>
          )}

          {step === "form" && formSchema && (
            <div className="rounded-2xl border border-emerald-200 bg-card p-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3 w-3" /> Payment confirmed</div>
              <h2 className="mb-6 text-2xl font-bold">Complete your application</h2>
              {formSchema.length === 0 ? <p className="text-muted-foreground">No form configured yet.</p> : <DynamicForm schema={formSchema} onSubmit={submitForm} busy={busy} />}
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
    </label>
  );
}
