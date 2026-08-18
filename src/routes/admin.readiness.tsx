import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, BarChart3, ArrowUp, ArrowDown, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/readiness")({
  head: () => ({ meta: [{ title: "Readiness Checklist — FAGE Admin" }] }),
  component: ReadinessAdmin,
});

type Item = {
  id: string;
  category: string;
  label: string;
  description: string | null;
  weight: number;
  display_order: number;
  active: boolean;
};

const empty: Omit<Item, "id"> = {
  category: "General",
  label: "",
  description: "",
  weight: 1,
  display_order: 0,
  active: true,
};

function ReadinessAdmin() {
  const [tab, setTab] = useState<"items" | "scores">("items");
  return (
    <AdminShell
      title="Export Readiness"
      description="Manage the checklist members complete and monitor aggregate scores."
    >
      <div className="mb-6 flex gap-2 border-b border-border">
        {(["items", "scores"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "items" ? "Checklist Items" : "Member Scores"}
          </button>
        ))}
      </div>
      {tab === "items" ? <ItemsPanel /> : <ScoresPanel />}
    </AdminShell>
  );
}

function ItemsPanel() {
  const [rows, setRows] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("readiness_checklist_items")
      .select("*")
      .order("display_order");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Item[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this checklist item? Member responses will be removed.")) return;
    const { error } = await supabase.from("readiness_checklist_items").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  async function reorder(idx: number, dir: -1 | 1) {
    const target = rows[idx + dir];
    const current = rows[idx];
    if (!target || !current) return;
    const a = supabase
      .from("readiness_checklist_items")
      .update({ display_order: target.display_order })
      .eq("id", current.id);
    const b = supabase
      .from("readiness_checklist_items")
      .update({ display_order: current.display_order })
      .eq("id", target.id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([a, b]);
    if (e1 || e2) toast.error((e1 || e2)!.message);
    else void load();
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
          <span>
            <strong>Serial No.</strong> is the top-to-bottom position members see. Use the arrows to
            reorder.
          </span>
        </p>

        <button
          onClick={() => setCreating(true)}
          className="flex flex-shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New item
        </button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">
          No checklist items yet. Members will see an empty readiness page until you add some.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Serial No.</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="tabular-nums">{r.display_order}</span>
                      <div className="flex flex-col">
                        <button
                          disabled={idx === 0}
                          onClick={() => reorder(idx, -1)}
                          className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
                          title="Move up"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          disabled={idx === rows.length - 1}
                          onClick={() => reorder(idx, 1)}
                          className="rounded p-0.5 hover:bg-accent disabled:opacity-30"
                          title="Move down"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-muted-foreground" title="Higher weight = bigger impact on score">
                    {r.weight}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${r.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
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
        <ItemEditor
          initial={editing ?? ({ id: "", ...empty } as Item)}
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
    </>
  );
}

function ItemEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: Item;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Item>(initial);
  const [busy, setBusy] = useState(false);

  function upd<K extends keyof Item>(k: K, v: Item[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      category: form.category,
      label: form.label,
      description: form.description || null,
      weight: form.weight,
      display_order: form.display_order,
      active: form.active,
    };
    const { error } = isNew
      ? await supabase.from("readiness_checklist_items").insert(payload)
      : await supabase.from("readiness_checklist_items").update(payload).eq("id", form.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isNew ? "Created" : "Updated");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <form
        onSubmit={save}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isNew ? "New checklist item" : "Edit item"}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Category">
            <input
              required
              value={form.category}
              onChange={(e) => upd("category", e.target.value)}
              className={inputCls}
              placeholder="e.g. Documentation"
            />
          </FormField>
          <FormField label="Display order">
            <input
              type="number"
              value={form.display_order}
              onChange={(e) => upd("display_order", Number(e.target.value))}
              className={inputCls}
            />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Label">
              <input
                required
                value={form.label}
                onChange={(e) => upd("label", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Description (optional)">
              <textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => upd("description", e.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>
          <FormField label="Weight" hint="Higher = bigger impact on score">
            <input
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => upd("weight", Math.max(1, Number(e.target.value)))}
              className={inputCls}
            />
          </FormField>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => upd("active", e.target.checked)}
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

type Score = {
  user_id: string;
  contact_name: string;
  company_name: string;
  member_id: string | null;
  tier: string;
  score: number;
};

function ScoresPanel() {
  const [rows, setRows] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<string>("all");

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: members } = await supabase
        .from("member_profiles")
        .select("user_id, contact_name, company_name, member_id, tier")
        .eq("status", "approved");
      const list: Score[] = [];
      for (const m of (members ?? []) as any[]) {
        const { data: score } = await supabase.rpc("get_readiness_score", { _user_id: m.user_id });
        list.push({ ...m, score: Number(score ?? 0) });
      }
      list.sort((a, b) => b.score - a.score);
      setRows(list);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (tierFilter === "all" ? rows : rows.filter((r) => r.tier === tierFilter)),
    [rows, tierFilter],
  );

  const avg = filtered.length
    ? Math.round(filtered.reduce((s, r) => s + r.score, 0) / filtered.length)
    : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">
            Average readiness:{" "}
            <span className="font-bold text-primary">{avg}%</span>{" "}
            <span className="text-muted-foreground">({filtered.length} members)</span>
          </span>
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className={`${inputCls} max-w-[180px]`}
        >
          <option value="all">All tiers</option>
          <option value="associate">Associate</option>
          <option value="standard">Standard</option>
          <option value="corporate">Corporate</option>
        </select>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Calculating scores…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Member ID</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.company_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_name}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.member_id ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.tier}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${r.score >= 80 ? "bg-emerald-500" : r.score >= 50 ? "bg-amber-500" : "bg-destructive"}`}
                          style={{ width: `${r.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums">{r.score}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
