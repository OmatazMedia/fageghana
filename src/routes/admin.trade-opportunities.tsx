// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Users, Download } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/trade-opportunities")({
  head: () => ({ meta: [{ title: "Trade Opportunities — FAGE Admin" }] }),
  component: TradeOpportunitiesAdmin,
});

type Opp = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  country: string | null;
  deadline: string | null;
  source: string | null;
  source_url: string | null;
  is_active: boolean;
  posted_at: string;
};

const empty: Omit<Opp, "id" | "posted_at"> = {
  title: "",
  description: "",
  category: "",
  country: "",
  deadline: null,
  source: "",
  source_url: "",
  is_active: true,
};

function TradeOpportunitiesAdmin() {
  const [rows, setRows] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Opp | null>(null);
  const [creating, setCreating] = useState(false);
  const [interestsFor, setInterestsFor] = useState<Opp | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("trade_opportunities")
      .select("*")
      .order("posted_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Opp[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this opportunity?")) return;
    const { error } = await supabase.from("trade_opportunities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  return (
    <AdminShell
      title="Trade Opportunities"
      description="Buyer leads, RFQs and export tenders for members."
      action={
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New opportunity
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No opportunities yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.country || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.deadline ? new Date(r.deadline).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.is_active ? "Active" : "Closed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setInterestsFor(r)}
                      className="mr-2 inline-flex items-center gap-1 rounded p-1.5 text-xs hover:bg-accent"
                      title="View interested members"
                    >
                      <Users className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditing(r)}
                      className="mr-2 rounded p-1.5 hover:bg-accent"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <OppEditor
          initial={editing ?? ({ id: "", posted_at: new Date().toISOString(), ...empty } as Opp)}
          isNew={creating}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            void load();
          }}
        />
      )}

      {interestsFor && (
        <InterestsDrawer opp={interestsFor} onClose={() => setInterestsFor(null)} />
      )}
    </AdminShell>
  );
}

function OppEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: Opp;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Opp>(initial);
  const [busy, setBusy] = useState(false);

  function upd<K extends keyof Opp>(k: K, v: Opp[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      category: form.category || null,
      country: form.country || null,
      deadline: form.deadline || null,
      source: form.source || null,
      source_url: form.source_url || null,
      is_active: form.is_active,
    };
    const { error } = isNew
      ? await supabase.from("trade_opportunities").insert(payload)
      : await supabase.from("trade_opportunities").update(payload).eq("id", form.id);

    if (!error && isNew) {
      // broadcast notification
      await supabase.from("notifications").insert({
        user_id: null,
        title: "New trade opportunity",
        body: form.title,
        link: "/dashboard",
      });
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isNew ? "Posted" : "Updated");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <form
        onSubmit={save}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isNew ? "New opportunity" : "Edit opportunity"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <FormField label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => upd("title", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Description">
              <textarea
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => upd("description", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>
          <FormField label="Category">
            <input
              value={form.category ?? ""}
              onChange={(e) => upd("category", e.target.value)}
              className={inputCls}
              placeholder="e.g. Cocoa, Cashew"
            />
          </FormField>
          <FormField label="Country">
            <input
              value={form.country ?? ""}
              onChange={(e) => upd("country", e.target.value)}
              className={inputCls}
              placeholder="e.g. Germany"
            />
          </FormField>
          <FormField label="Deadline">
            <input
              type="date"
              value={form.deadline ?? ""}
              onChange={(e) => upd("deadline", e.target.value || null)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Source">
            <input
              value={form.source ?? ""}
              onChange={(e) => upd("source", e.target.value)}
              className={inputCls}
              placeholder="e.g. GEPA, ITC"
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Source URL">
              <input
                type="url"
                value={form.source_url ?? ""}
                onChange={(e) => upd("source_url", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>
          <label className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => upd("is_active", e.target.checked)}
            />
            <span className="text-sm">Active (visible to members)</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-5 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

type Interest = {
  id: string;
  created_at: string;
  message: string | null;
  user_id: string;
  profile?: {
    contact_name: string;
    company_name: string;
    email: string;
    member_id: string | null;
  };
};

function InterestsDrawer({ opp, onClose }: { opp: any; onClose: () => void }) {
  const [rows, setRows] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_opportunity_interests")
        .select("id, created_at, message, user_id")
        .eq("opportunity_id", opp.id)
        .order("created_at", { ascending: false });
      const interests = (data ?? []) as Interest[];
      if (interests.length) {
        const userIds = interests.map((r) => r.user_id);
        const { data: profs } = await supabase
          .from("member_profiles")
          .select("user_id, contact_name, company_name, email, member_id")
          .in("user_id", userIds);
        const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
        interests.forEach((i) => {
          i.profile = map.get(i.user_id);
        });
      }
      setRows(interests);
      setLoading(false);
    })();
  }, [opp.id]);

  function exportCsv() {
    const header = ["Member ID", "Contact", "Company", "Email", "Message", "Date"];
    const lines = rows.map((r) =>
      [
        r.profile?.member_id ?? "",
        r.profile?.contact_name ?? "",
        r.profile?.company_name ?? "",
        r.profile?.email ?? "",
        (r.message ?? "").replace(/[\r\n,]/g, " "),
        new Date(r.created_at).toLocaleString(),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interests-${opp.title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-foreground/40">
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="font-bold">Interested members</h3>
            <p className="text-xs text-muted-foreground">{opp.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={!rows.length}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs disabled:opacity-50"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interests yet.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{r.profile?.contact_name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.profile?.company_name} · {r.profile?.email} ·{" "}
                    {r.profile?.member_id ?? "no ID"}
                  </div>
                  {r.message && <p className="mt-2 text-sm">{r.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
