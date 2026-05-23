import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { testPaymentGateway } from "@/lib/payments.functions";

export const Route = createFileRoute("/admin/gateways")({
  head: () => ({ meta: [{ title: "Payment Gateways — Admin" }] }),
  component: GatewaysPage,
});

function GatewaysPage() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const testGateway = useServerFn(testPaymentGateway);

  async function load() {
    const { data } = await supabase.from("payment_gateways").select("*").order("display_order");
    setItems(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const provider = String(fd.get("provider"));
    const isOnline = provider !== "manual_bank";
    const payload: any = {
      name: String(fd.get("name")),
      provider,
      enabled: fd.get("enabled") === "on",
      display_order: Number(fd.get("display_order") ?? 0),
      config: isOnline
        ? {
            public_key: String(fd.get("public_key") ?? ""),
            secret_key: String(fd.get("secret_key") ?? ""),
            webhook_secret: String(fd.get("webhook_secret") ?? ""),
          }
        : {},
      bank_details: provider === "manual_bank" ? { bank: String(fd.get("bank") ?? ""), account_name: String(fd.get("account_name") ?? ""), account_number: String(fd.get("account_number") ?? ""), branch: String(fd.get("branch") ?? "") } : null,
    };
    const { error } = editing?.id
      ? await supabase.from("payment_gateways").update(payload).eq("id", editing.id)
      : await supabase.from("payment_gateways").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setEditing(null); await load();
  }

  async function toggle(g: any) {
    await supabase.from("payment_gateways").update({ enabled: !g.enabled }).eq("id", g.id);
    await load();
  }
  async function remove(id: string) {
    if (!confirm("Delete gateway?")) return;
    await supabase.from("payment_gateways").delete().eq("id", id);
    await load();
  }

  async function runGatewayTest(g: any) {
    setTestingId(g.id);
    try {
      const res = await testGateway({ data: { gateway_id: g.id } });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.message ?? "Gateway test failed");
    } finally {
      setTestingId(null);
    }
  }

  return (
    <AdminShell title="Payment Gateways" description="Configure Paystack, Hubtel, Flutterwave, or manual bank deposit options."
      action={<button onClick={() => setEditing({})} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Add gateway</button>}>
      <div className="space-y-3">
        {items.map(g => (
          <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <div className="font-semibold">{g.name} <span className="ml-2 text-xs text-muted-foreground capitalize">{g.provider.replace("_"," ")}</span></div>
              <div className="text-xs text-muted-foreground">Order {g.display_order}</div>
              {g.provider === "paystack" && <div className="mt-1 text-xs text-muted-foreground">Webhook: /api/public/paystack-webhook · Callback: /payment/callback</div>}
              {g.provider === "flutterwave" && <div className="mt-1 text-xs text-muted-foreground">Webhook: /api/public/flutterwave-webhook · Callback: /payment/callback</div>}
            </div>
            <div className="flex items-center gap-2">
              {(g.provider === "paystack" || g.provider === "flutterwave") && (
                <button disabled={testingId === g.id} onClick={() => runGatewayTest(g)} className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary disabled:opacity-60">
                  {testingId === g.id ? "Testing…" : "Test connection"}
                </button>
              )}
              <button onClick={() => toggle(g)} className={`rounded-full px-3 py-1 text-xs ${g.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted"}`}>{g.enabled ? "Enabled" : "Disabled"}</button>
              <button onClick={() => setEditing(g)} className="text-sm text-primary">Edit</button>
              <button onClick={() => remove(g.id)} className="text-sm text-destructive">Delete</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No gateways yet.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-lg space-y-3 rounded-2xl bg-card p-6">
            <h2 className="text-lg font-bold">{editing.id ? "Edit" : "New"} gateway</h2>
            <FormField label="Display name"><input name="name" required className={inputCls} defaultValue={editing.name} /></FormField>
            <FormField label="Provider">
              <select name="provider" className={inputCls} defaultValue={editing.provider ?? "paystack"}>
                <option value="paystack">Paystack</option>
                <option value="hubtel">Hubtel</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="manual_bank">Manual Bank Deposit</option>
              </select>
            </FormField>
            <FormField label="Display order"><input name="display_order" type="number" className={inputCls} defaultValue={editing.display_order ?? 0} /></FormField>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={editing.enabled ?? false} /> Enabled</label>
            <details className="rounded-lg bg-muted/30 p-3" open>
              <summary className="cursor-pointer text-sm font-medium">Online provider keys</summary>
              <FormField label="Public key"><input name="public_key" className={inputCls} defaultValue={editing.config?.public_key ?? ""} /></FormField>
              <FormField label="Secret key"><input name="secret_key" type="password" className={inputCls} defaultValue={editing.config?.secret_key ?? ""} /></FormField>
              <FormField label="Webhook secret (Flutterwave verif-hash, optional for Paystack)"><input name="webhook_secret" type="password" className={inputCls} defaultValue={editing.config?.webhook_secret ?? ""} /></FormField>
            </details>
            <details className="rounded-lg bg-muted/30 p-3">
              <summary className="cursor-pointer text-sm font-medium">Manual bank details</summary>
              <FormField label="Bank"><input name="bank" className={inputCls} defaultValue={editing.bank_details?.bank ?? ""} /></FormField>
              <FormField label="Account name"><input name="account_name" className={inputCls} defaultValue={editing.bank_details?.account_name ?? ""} /></FormField>
              <FormField label="Account number"><input name="account_number" className={inputCls} defaultValue={editing.bank_details?.account_number ?? ""} /></FormField>
              <FormField label="Branch"><input name="branch" className={inputCls} defaultValue={editing.bank_details?.branch ?? ""} /></FormField>
            </details>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm">Cancel</button>
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save</button>
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}
