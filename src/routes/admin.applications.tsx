import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, Building2, MapPin, X, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/applications")({
  head: () => ({ meta: [{ title: "Membership Applications — FAGE Admin" }] }),
  component: ApplicationsAdmin,
});

type Status = "new" | "reviewing" | "approved" | "rejected";
type Tier = "associate" | "corporate";
type AppRow = {
  id: string;
  tier: Tier;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  industry: string | null;
  products_exported: string | null;
  message: string | null;
  status: Status;
  admin_notes: string | null;
  created_at: string;
};

const STATUSES: Status[] = ["new", "reviewing", "approved", "rejected"];

function ApplicationsAdmin() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [selected, setSelected] = useState<AppRow | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("membership_applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as AppRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this application?")) return;
    const { error } = await supabase.from("membership_applications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setSelected(null);
      void load();
    }
  }

  const filtered = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const statusCls: Record<Status, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    reviewing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-primary/10 text-primary",
    rejected: "bg-destructive/10 text-destructive",
  };

  return (
    <AdminShell title="Membership Applications" description="Review and process applications.">
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => {
          const count = s === "all" ? rows.length : rows.filter((r) => r.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${filter === s ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
            >
              {s} <span className="opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">No applications.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{r.company_name}</td>
                  <td className="px-4 py-3">
                    <div>{r.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.tier}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusCls[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ApplicationDetail
          app={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
          onDelete={() => remove(selected.id)}
        />
      )}
    </AdminShell>
  );
}

function ApplicationDetail({
  app,
  onClose,
  onChanged,
  onDelete,
}: {
  app: AppRow;
  onClose: () => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [status, setStatus] = useState<Status>(app.status);
  const [notes, setNotes] = useState(app.admin_notes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("membership_applications")
      .update({ status, admin_notes: notes || null })
      .eq("id", app.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Saved");
      onChanged();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4 backdrop-blur">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{app.company_name}</h2>
            <p className="text-sm capitalize text-muted-foreground">
              {app.tier} membership · submitted {new Date(app.created_at).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> {app.contact_name}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> {app.country}
          </div>
          <a href={`mailto:${app.email}`} className="flex items-center gap-2 hover:text-primary">
            <Mail className="h-4 w-4 text-primary" /> {app.email}
          </a>
          <a href={`tel:${app.phone}`} className="flex items-center gap-2 hover:text-primary">
            <Phone className="h-4 w-4 text-primary" /> {app.phone}
          </a>
        </div>

        {app.industry && (
          <div className="mt-4">
            <div className="text-xs font-medium uppercase text-muted-foreground">Industry</div>
            <div className="text-sm">{app.industry}</div>
          </div>
        )}
        {app.products_exported && (
          <div className="mt-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Products exported
            </div>
            <div className="text-sm">{app.products_exported}</div>
          </div>
        )}
        {app.message && (
          <div className="mt-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Message</div>
            <div className="whitespace-pre-wrap text-sm">{app.message}</div>
          </div>
        )}

        <div className="mt-6 space-y-4 border-t border-border pt-6">
          <FormField label="Status">
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Admin notes">
            <textarea
              rows={3}
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
          <div className="flex justify-between">
            <button
              onClick={onDelete}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="rounded-full px-4 py-2 text-sm hover:bg-accent">
                Close
              </button>
              <button
                onClick={save}
                disabled={busy}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
