import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";
import { downloadFile } from "@/lib/forceDownload";
import { FileDown, Save, Upload } from "lucide-react";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({ meta: [{ title: "Membership Plans — Admin" }] }),
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("subscription_plans").select("*").order("amount");
    const rows = data ?? [];
    setPlans(rows);
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
          {activePlan && (
            <form
              key={activePlan.id}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save(activePlan, {
                  amount: Number(fd.get("amount")),
                  currency: String(fd.get("currency")),
                  duration_months: Number(fd.get("duration_months")),
                  description: String(fd.get("description")),
                  post_download_message: String(fd.get("post_download_message")),
                  bank_deposit_email: String(fd.get("bank_deposit_email")),
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
            </form>
          )}
        </div>
      )}
    </AdminShell>
  );
}
