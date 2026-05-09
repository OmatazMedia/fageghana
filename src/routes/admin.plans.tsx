import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";
import { downloadFile } from "@/lib/forceDownload";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({ meta: [{ title: "Membership Plans — Admin" }] }),
  component: PlansPage,
});

function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase.from("subscription_plans").select("*").order("amount");
    setPlans(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function save(plan: any, patch: any) {
    const { error } = await supabase.from("subscription_plans").update(patch).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    await load();
  }

  async function uploadPdf(plan: any, file: File) {
    try {
      const url = await uploadImage(file, `forms/${plan.tier}`);
      await save(plan, { application_form_pdf_url: url });
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <AdminShell title="Membership Plans" description="Set pricing, downloadable forms, and the message shown after a member downloads the form.">
      <div className="space-y-4">
        {plans.map(p => (
          <form key={p.id} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); save(p, {
            amount: Number(fd.get("amount")),
            currency: String(fd.get("currency")),
            duration_months: Number(fd.get("duration_months")),
            description: String(fd.get("description")),
            post_download_message: String(fd.get("post_download_message")),
            bank_deposit_email: String(fd.get("bank_deposit_email")),
          }); }} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold capitalize">{p.tier} membership</h3>
              {p.application_form_pdf_url && <a href={p.application_form_pdf_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">View current PDF</a>}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <FormField label="Amount"><input name="amount" type="number" step="0.01" defaultValue={p.amount} className={inputCls} /></FormField>
              <FormField label="Currency"><input name="currency" defaultValue={p.currency} className={inputCls} /></FormField>
              <FormField label="Duration (months)"><input name="duration_months" type="number" defaultValue={p.duration_months} className={inputCls} /></FormField>
            </div>
            <FormField label="Description"><input name="description" defaultValue={p.description ?? ""} className={inputCls} /></FormField>
            <FormField label="Application form PDF" hint="Members can download this from the membership page">
              <input type="file" accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPdf(p, f); }} className={inputCls} />
            </FormField>
            <FormField label="Post-download message" hint="Shown as a toast after the member downloads the form">
              <textarea name="post_download_message" defaultValue={p.post_download_message ?? ""} rows={3} className={inputCls} />
            </FormField>
            <FormField label="Bank deposit email" hint="Where members are told to email their proof of payment">
              <input name="bank_deposit_email" type="email" defaultValue={p.bank_deposit_email ?? ""} className={inputCls} />
            </FormField>
            <button className="mt-3 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save plan</button>
          </form>
        ))}
      </div>
    </AdminShell>
  );
}
