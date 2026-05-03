import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("pending");

  async function load() {
    const { data } = await supabase.from("payment_submissions")
      .select("*, payment_gateways(name,provider), member_profiles!inner(member_id,contact_name,company_name,email,tier,subscription_expiry)")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function confirm(p: any) {
    const notes = prompt("Notes for member (optional)") ?? "";
    // Compute new expiry
    const profile = p.member_profiles;
    const baseDate = profile.subscription_expiry && new Date(profile.subscription_expiry) > new Date()
      ? new Date(profile.subscription_expiry) : new Date();
    const newExpiry = new Date(baseDate);
    newExpiry.setMonth(newExpiry.getMonth() + (p.duration_months ?? 12));

    const updates: any = {
      subscription_expiry: newExpiry.toISOString(),
      subscription_start: profile.subscription_expiry ? profile.subscription_expiry : new Date().toISOString(),
    };
    if (!profile.member_id) {
      const { data: gen } = await supabase.rpc("generate_member_id" as any, { _tier: profile.tier });
      if (gen) updates.member_id = gen;
    }
    await supabase.from("member_profiles").update(updates).eq("user_id", p.user_id);
    await supabase.from("payment_submissions").update({ status: "confirmed", admin_notes: notes, confirmed_at: new Date().toISOString() }).eq("id", p.id);
    await supabase.from("notifications").insert({ user_id: p.user_id, title: "Payment confirmed", body: `Your subscription has been extended to ${newExpiry.toLocaleDateString()}.` });
    toast.success("Confirmed"); await load();
  }

  async function reject(p: any) {
    const notes = prompt("Reason for rejection") ?? "";
    await supabase.from("payment_submissions").update({ status: "rejected", admin_notes: notes }).eq("id", p.id);
    await supabase.from("notifications").insert({ user_id: p.user_id, title: "Payment not accepted", body: notes || "Please review your payment and try again." });
    await load();
  }

  async function viewProof(path: string) {
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);

  return (
    <AdminShell title="Payments" description="Review member payment submissions.">
      <div className="mb-4 flex gap-2">
        {(["pending","confirmed","rejected","all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-sm capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{f}</button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{p.member_profiles?.contact_name} — {p.member_profiles?.company_name}</div>
                <div className="text-xs text-muted-foreground">{p.member_profiles?.email} · ID: {p.member_profiles?.member_id ?? "—"}</div>
                <div className="mt-2 text-sm">{p.currency} {Number(p.amount).toLocaleString()} via {p.payment_gateways?.name ?? p.method} · Ref: {p.reference || "—"}</div>
                {p.member_message && <div className="mt-1 text-xs text-muted-foreground italic">"{p.member_message}"</div>}
                <div className="mt-1 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${p.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : p.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
                {p.proof_url && <button onClick={() => viewProof(p.proof_url)} className="text-xs text-primary hover:underline">View proof</button>}
                {p.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => confirm(p)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Confirm</button>
                    <button onClick={() => reject(p)} className="rounded-full bg-destructive px-3 py-1 text-xs text-white">Reject</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">No payments.</p>}
      </div>
    </AdminShell>
  );
}
