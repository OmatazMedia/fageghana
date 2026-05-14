import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/certificates/issue")({
  head: () => ({ meta: [{ title: "Batch Issue Certificates — Admin" }] }),
  component: BatchIssue,
});

function BatchIssue() {
  const [members, setMembers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [existingByUser, setExistingByUser] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrideExpiry, setOverrideExpiry] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [m, t, c] = await Promise.all([
      supabase.from("member_profiles").select("*").not("member_id", "is", null).not("subscription_expiry", "is", null),
      supabase.from("certificate_templates").select("*").eq("is_active", true),
      supabase.from("certificates").select("user_id, expires_at").eq("revoked", false),
    ]);
    setMembers(m.data ?? []); setTemplates(t.data ?? []);
    const map: Record<string, boolean> = {};
    (c.data ?? []).forEach((row: any) => {
      if (new Date(row.expires_at) > new Date()) map[row.user_id] = true;
    });
    setExistingByUser(map);
  }
  useEffect(() => { void load(); }, []);

  const eligible = useMemo(
    () => members.filter(m => !existingByUser[m.user_id] && m.subscription_expiry && new Date(m.subscription_expiry) > new Date()),
    [members, existingByUser]
  );

  function toggle(uid: string) {
    setSelected(s => {
      const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n;
    });
  }
  function selectAll() { setSelected(new Set(eligible.map(m => m.user_id))); }

  async function issue() {
    if (selected.size === 0) return toast.error("Select at least one member");
    setBusy(true);
    let ok = 0, fail = 0;
    for (const uid of selected) {
      const m = members.find(x => x.user_id === uid);
      if (!m) continue;
      const tpl = templates.find(t => t.tier === m.tier);
      if (!tpl) { fail++; continue; }
      const expires = overrideExpiry ? new Date(overrideExpiry).toISOString() : m.subscription_expiry;
      const code = `FAGE${m.member_id.replace(/[^A-Z0-9]/g, "")}${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const { error } = await supabase.from("certificates").insert({
        user_id: uid, template_id: tpl.id, member_id: m.member_id,
        full_name: m.contact_name || m.company_name, tier: m.tier,
        expires_at: expires, verification_code: code,
      });
      if (error) { fail++; continue; }
      await supabase.from("notifications").insert({ user_id: uid, title: "Your certificate is ready", body: "Your FAGE membership certificate has been issued. Visit your dashboard to download." });
      ok++;
    }
    setBusy(false); setSelected(new Set());
    toast.success(`Issued ${ok}${fail ? ` · ${fail} failed (no template)` : ""}`);
    await load();
  }

  return (
    <AdminShell
      title="Batch Issue Certificates"
      description="Issue certificates to all eligible members with confirmed payments."
      action={<Link to="/admin/certificates" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back</Link>}
    >
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium">Override expiry (optional)</label>
          <input type="date" value={overrideExpiry} onChange={e => setOverrideExpiry(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Defaults to each member's subscription expiry.</p>
        </div>
        <button onClick={selectAll} className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent">Select all eligible</button>
        <button onClick={issue} disabled={busy || selected.size === 0} className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          <Layers className="h-4 w-4" /> Issue {selected.size > 0 && `(${selected.size})`}
        </button>
      </div>

      {eligible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No eligible members. Members appear here once payment is confirmed and subscription is active.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr><th className="px-3 py-2 text-left">Sel</th><th className="px-3 py-2 text-left">Member ID</th><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Tier</th><th className="px-3 py-2 text-left">Expires</th></tr>
            </thead>
            <tbody>
              {eligible.map(m => (
                <tr key={m.user_id} className="border-t border-border">
                  <td className="px-3 py-2"><input type="checkbox" checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} /></td>
                  <td className="px-3 py-2 font-mono text-xs">{m.member_id}</td>
                  <td className="px-3 py-2">{m.contact_name || m.company_name}</td>
                  <td className="px-3 py-2 capitalize">{m.tier}</td>
                  <td className="px-3 py-2">{new Date(m.subscription_expiry).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
