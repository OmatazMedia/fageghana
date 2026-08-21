import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/api/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";
import { downloadFile } from "@/lib/forceDownload";
import { getMemberIdNext, setMemberIdStart } from "@/lib/backup.functions";
import { FileDown, Save, Upload, Hash } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({ meta: [{ title: "Membership Plans — Admin" }] }),
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  async function load() {
    const [{ data }, { data: tpl }] = await Promise.all([
      supabase.from("subscription_plans").select("*").order("amount"),
      supabase.from("certificate_templates").select("id,name,tier,is_active").order("name"),
    ]);
    const rows = data ?? [];
    setPlans(rows);
    setTemplates(tpl ?? []);
    if (rows.length > 0 && !activeTab) setActiveTab(rows[0].id);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(plan: any, patch: any) {
    const { error } = await supabase.from("subscription_plans").update(patch).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Plan saved");
    await load();
  }

  async function uploadPdf(plan: any, file: File) {
    try {
      const url = await uploadImage(file, `forms/${plan.tier}`);
      await save(plan, { application_form_pdf_url: url });
      toast.success("PDF uploaded");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const activePlan = plans.find((p) => p.id === activeTab);

  return (
    <AdminShell
      title="Membership Plans"
      description="Configure pricing, application forms, and messaging for each membership tier."
    >
      <MemberIdStartCard />

      {plans.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          Loading plans…
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
          {/* ── Tabs ── */}
          <div className="relative flex border-b border-border bg-muted/30">
            {plans.map((p) => {
              const isActive = activeTab === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveTab(p.id)}
                  className={`relative flex-1 px-6 py-4 text-sm font-semibold capitalize transition-colors focus:outline-none ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="plan-tab-active"
                      className="absolute inset-0 bg-[hsl(140_55%_92%)] dark:bg-[hsl(140_40%_22%)]"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  {isActive && (
                    <motion.span
                      layoutId="plan-tab-underline"
                      className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {p.tier} Membership
                    {isActive && (
                      <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wide">
                        Active
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Tab content ── */}
          <AnimatePresence mode="wait" initial={false}>
            {activePlan && (
              <motion.form
                key={activePlan.id}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const certId = String(fd.get("certificate_template_id") || "");
                  save(activePlan, {
                    amount: Number(fd.get("amount")),
                    currency: String(fd.get("currency")),
                    duration_months: Number(fd.get("duration_months")),
                    description: String(fd.get("description")),
                    post_download_message: String(fd.get("post_download_message")),
                    bank_deposit_email: String(fd.get("bank_deposit_email")),
                    certificate_template_id: certId || null,
                  });
                }}
                className="p-6 lg:p-8"
              >
              {/* Plan header */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold capitalize text-foreground">
                    {activePlan.tier} Membership
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Configure pricing and settings for this tier
                  </p>
                </div>
                {activePlan.application_form_pdf_url && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(
                        activePlan.application_form_pdf_url,
                        `FAGE-${activePlan.tier}-application.pdf`,
                      )
                    }
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 transition"
                  >
                    <FileDown className="h-4 w-4" />
                    Download current PDF
                  </button>
                )}
              </div>

              {/* Pricing row */}
              <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Amount">
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={activePlan.amount}
                    className={inputCls}
                  />
                </FormField>
                <FormField label="Currency">
                  <input name="currency" defaultValue={activePlan.currency} className={inputCls} />
                </FormField>
                <FormField label="Duration (months)">
                  <input
                    name="duration_months"
                    type="number"
                    defaultValue={activePlan.duration_months}
                    className={inputCls}
                  />
                </FormField>
              </div>

              <div className="mb-4">
                <FormField label="Description">
                  <input
                    name="description"
                    defaultValue={activePlan.description ?? ""}
                    placeholder="Short description shown to members"
                    className={inputCls}
                  />
                </FormField>
              </div>

              {/* PDF upload */}
              <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/20 p-5">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Upload className="h-4 w-4 text-primary" />
                  Application Form PDF
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Members can download this from the public membership page.
                </p>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadPdf(activePlan, f);
                  }}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-primary/90"
                />
              </div>

              <div className="mb-4">
                <FormField
                  label="Post-download message"
                  hint="Shown as a notification after the member downloads the form"
                >
                  <textarea
                    name="post_download_message"
                    defaultValue={activePlan.post_download_message ?? ""}
                    rows={3}
                    placeholder="e.g. Please complete the form and email it to membership@fageghana.com"
                    className={inputCls}
                  />
                </FormField>
              </div>

              <div className="mb-6">
                <FormField
                  label="Bank deposit email"
                  hint="Where members are told to email their proof of payment"
                >
                  <input
                    name="bank_deposit_email"
                    type="email"
                    defaultValue={activePlan.bank_deposit_email ?? ""}
                    placeholder="payments@fageghana.com"
                    className={inputCls}
                  />
                </FormField>
              </div>

              <div className="mb-6">
                <FormField
                  label="Certificate template"
                  hint="Which certificate format issued members of this plan receive."
                >
                  <select
                    name="certificate_template_id"
                    defaultValue={activePlan.certificate_template_id ?? ""}
                    className={inputCls}
                  >
                    <option value="">Auto (match by tier)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.tier ? `· ${t.tier}` : ""} {t.is_active ? "" : "(inactive)"}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Save */}
              <div className="flex justify-end border-t border-border pt-5">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition"
                >
                  <Save className="h-4 w-4" />
                  Save plan
                </button>
              </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </AdminShell>
  );
}

function MemberIdStartCard() {
  const runGet = getMemberIdNext;
  const runSet = setMemberIdStart;
  const [next, setNext] = useState<number | null>(null);
  const [input, setInput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    runGet()
      .then((r) => {
        setNext(r.next);
        setInput(String(r.next));
      })
      .catch(() => {});
  }, []);

  async function save() {
    const n = parseInt(input, 10);
    if (!Number.isFinite(n) || n < 1) return toast.error("Enter a positive integer");
    setBusy(true);
    try {
      const r = await runSet({ data: { next: n } });
      setNext(r.next);
      toast.success(`Next auto-generated member number is now ${r.next}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Hash className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold">Member ID auto-generation</h3>
            <p className="text-xs text-muted-foreground">
              The next member ID will use number{" "}
              <strong className="text-foreground">{next ?? "…"}</strong>. Reset the starting
              point below to change where auto-generation continues.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={inputCls + " w-32"}
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set start"}
          </button>
        </div>
      </div>
    </div>
  );
}
