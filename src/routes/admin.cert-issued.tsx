import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileDown, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/cert-issued")({
  head: () => ({ meta: [{ title: "Issued Certificates — Admin" }] }),
  component: Issued,
});

function Issued() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "expired" | "revoked">("all");

  async function load() {
    const { data } = await supabase.from("certificates").select("*").order("issued_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    return items.filter(c => {
      const status = c.revoked ? "revoked" : new Date(c.expires_at) > new Date() ? "active" : "expired";
      if (filter !== "all" && status !== filter) return false;
      if (q && !`${c.full_name} ${c.member_id} ${c.verification_code}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [items, q, filter]);

  async function revoke(c: any) {
    if (!confirm("Revoke this certificate?")) return;
    await supabase.from("certificates").update({ revoked: true }).eq("id", c.id);
    toast.success("Revoked"); await load();
  }
  async function unrevoke(c: any) {
    await supabase.from("certificates").update({ revoked: false }).eq("id", c.id);
    await load();
  }

  return (
    <AdminShell
      title="Issued Certificates"
      description="All certificates ever issued."
      action={<Link to="/admin/certificates" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, ID or code…"
          className="flex-1 min-w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex rounded-full bg-muted p-1">
          {(["all","active","expired","revoked"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs capitalize ${filter === f ? "bg-primary text-primary-foreground" : ""}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Member</th><th className="px-3 py-2 text-left">ID</th>
              <th className="px-3 py-2 text-left">Tier</th><th className="px-3 py-2 text-left">Issued</th>
              <th className="px-3 py-2 text-left">Expires</th><th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const status = c.revoked ? "revoked" : new Date(c.expires_at) > new Date() ? "active" : "expired";
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">{c.full_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.member_id}</td>
                  <td className="px-3 py-2 capitalize">{c.tier}</td>
                  <td className="px-3 py-2">{new Date(c.issued_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{new Date(c.expires_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${status === "active" ? "bg-emerald-100 text-emerald-700" : status === "expired" ? "bg-amber-100 text-amber-700" : "bg-destructive/10 text-destructive"}`}>{status}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Link to="/certificate/$id" params={{ id: c.id }} className="flex items-center gap-1 text-xs text-primary hover:underline"><FileDown className="h-3 w-3" /> View</Link>
                      <Link to="/verify/$code" params={{ code: c.verification_code }} className="text-xs text-primary hover:underline">Verify</Link>
                      {c.revoked
                        ? <button onClick={() => unrevoke(c)} className="flex items-center gap-1 text-xs text-emerald-600"><RotateCcw className="h-3 w-3" /> Restore</button>
                        : <button onClick={() => revoke(c)} className="flex items-center gap-1 text-xs text-destructive"><Ban className="h-3 w-3" /> Revoke</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">No certificates match.</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
