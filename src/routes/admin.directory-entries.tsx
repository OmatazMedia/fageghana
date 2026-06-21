import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Upload, MoreHorizontal, Star, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { uploadImage } from "@/lib/uploadImage";
import {
  DynamicFieldRenderer,
  type CustomFieldDef,
} from "@/components/admin/DynamicFieldRenderer";

export const Route = createFileRoute("/admin/directory-entries")({
  head: () => ({ meta: [{ title: "Directory Entries — Admin" }] }),
  component: DirectoryEntriesAdmin,
});

type Executive = { role: string; name: string };
type Entry = {
  id: string;
  entry_type: "association" | "corporate";
  slug: string;
  company_name: string;
  short_description: string | null;
  long_description: string | null;
  mission: string | null;
  vision: string | null;
  services: string[];
  products: string[];
  executives: Executive[];
  director_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  physical_address: string | null;
  postal_address: string | null;
  country: string;
  region: string | null;
  logo_url: string | null;
  category: string | null;
  featured: boolean;
  display_order: number;
  published: boolean;
  custom_fields: Record<string, any>;
  user_id: string | null;
  status: "draft" | "pending" | "approved" | "rejected" | "suspended";
  review_notes: string | null;
};

const blank: Entry = {
  id: "",
  entry_type: "corporate",
  slug: "",
  company_name: "",
  short_description: "",
  long_description: "",
  mission: "",
  vision: "",
  services: [],
  products: [],
  executives: [],
  director_name: "",
  contact_name: "",
  phone: "",
  email: "",
  website: "",
  physical_address: "",
  postal_address: "",
  country: "Ghana",
  region: "",
  logo_url: "",
  category: "",
  featured: false,
  display_order: 0,
  published: true,
  custom_fields: {},
  user_id: null,
  status: "approved",
  review_notes: null,
};

const STATUS_META: Record<Entry["status"], { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
  suspended: { label: "Suspended", cls: "bg-orange-100 text-orange-700" },
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function DirectoryEntriesAdmin() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "association" | "corporate">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | Entry["status"]>("all");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);
  const [rejecting, setRejecting] = useState<Entry | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLinkOpen, setBulkLinkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [q, type, statusFilter]);


  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("directory_entries")
      .select("*")
      .order("entry_type")
      .order("display_order");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as any);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (type !== "all" && r.entry_type !== type) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.company_name.toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.category ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, type, statusFilter]);

  async function togglePublished(r: Entry) {
    const { error } = await supabase
      .from("directory_entries")
      .update({ published: !r.published })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success(r.published ? "Hidden" : "Published");
      setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, published: !x.published } : x)));
    }
  }

  async function toggleFeatured(r: Entry) {
    const { error } = await supabase
      .from("directory_entries")
      .update({ featured: !r.featured })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, featured: !x.featured } : x)));
  }

  async function review(r: Entry, action: "approve" | "reject" | "withdraw" | "suspend", notes?: string) {
    const { error } = await supabase.rpc("admin_review_directory_entry", {
      _id: r.id,
      _action: action,
      _notes: notes ?? undefined,
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Entry ${action}d`);
    await load();
  }

  async function save(e: Entry) {
    const payload = {
      entry_type: e.entry_type,
      slug: e.slug || slugify(e.company_name),
      company_name: e.company_name,
      short_description: e.short_description || null,
      long_description: e.long_description || null,
      mission: e.mission || null,
      vision: e.vision || null,
      services: e.services,
      products: e.products,
      executives: e.executives,
      director_name: e.director_name || null,
      contact_name: e.contact_name || null,
      phone: e.phone || null,
      email: e.email || null,
      website: e.website || null,
      physical_address: e.physical_address || null,
      postal_address: e.postal_address || null,
      country: e.country || "Ghana",
      region: e.region || null,
      logo_url: e.logo_url || null,
      category: e.category || null,
      featured: e.featured,
      display_order: e.display_order,
      published: e.published,
      custom_fields: e.custom_fields ?? {},
      user_id: e.user_id ?? null,
      status: e.status,
    };
    const res = e.id
      ? await supabase.from("directory_entries").update(payload).eq("id", e.id)
      : await supabase.from("directory_entries").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(e.id ? "Entry updated" : "Entry created");
    setEditing(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("directory_entries").delete().eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setDeleting(null);
      await load();
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAllFiltered(ids: string[], allSelected: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) ids.forEach((i) => next.delete(i));
      else ids.forEach((i) => next.add(i));
      return next;
    });
  }

  async function bulkReview(action: "approve" | "reject" | "suspend") {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`${action[0].toUpperCase() + action.slice(1)} ${ids.length} entr${ids.length === 1 ? "y" : "ies"}?`)) return;
    setBulkBusy(true);
    let ok = 0;
    let fail = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("admin_review_directory_entry", {
        _id: id,
        _action: action,
      } as any);
      if (error) fail++;
      else ok++;
    }
    setBulkBusy(false);
    toast[fail ? "warning" : "success"](`${ok} ${action}d${fail ? `, ${fail} failed` : ""}`);
    setSelectedIds(new Set());
    await load();
  }

  async function bulkLink(userId: string | null) {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    const { error } = await supabase
      .from("directory_entries")
      .update({ user_id: userId })
      .in("id", ids);
    setBulkBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(userId ? `Linked ${ids.length} entr${ids.length === 1 ? "y" : "ies"} to member` : `Unlinked ${ids.length}`);
    setBulkLinkOpen(false);
    setSelectedIds(new Set());
    await load();
  }


  return (
    <AdminShell
      title="Directory Entries"
      description="Curated entries for the public exporter directory (associations & corporate members)."
      action={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/directory-fields"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" /> Manage form fields
          </Link>
          <button
            onClick={() => setEditing({ ...blank })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> New entry
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search company, email, phone, category…"
          className={inputCls + " max-w-md"}
        />
        <div className="flex gap-2">
          {(["all", "association", "corporate"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${type === k ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={inputCls + " max-w-[180px]"}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="suspended">Suspended</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              disabled={bulkBusy}
              onClick={() => bulkReview("approve")}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => bulkReview("suspend")}
              className="rounded-full bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Suspend
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => bulkReview("reject")}
              className="rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
            >
              Reject
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => setBulkLinkOpen(true)}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              Link to member…
            </button>
            <button
              disabled={bulkBusy}
              onClick={() => bulkLink(null)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              Unlink member
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          <table className="w-full text-sm">

            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No entries
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.featured && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                        <span className="font-medium">{r.company_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 capitalize">{r.entry_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {r.email ?? "—"}
                      <br />
                      {r.phone ?? ""}
                    </td>
                    <td className="px-4 py-3">{r.display_order}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_META[r.status]?.cls ?? ""}`}
                        >
                          {STATUS_META[r.status]?.label ?? r.status}
                        </span>
                        <button
                          onClick={() => togglePublished(r)}
                          className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-medium ${r.published ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                        >
                          {r.published ? "Visible" : "Hidden"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditing(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {r.status !== "approved" && (
                            <DropdownMenuItem onClick={() => review(r, "approve")}>
                              <Star className="mr-2 h-4 w-4" /> Approve
                            </DropdownMenuItem>
                          )}
                          {r.status === "approved" && (
                            <DropdownMenuItem onClick={() => review(r, "withdraw")}>
                              <Star className="mr-2 h-4 w-4" /> Withdraw approval
                            </DropdownMenuItem>
                          )}
                          {r.status !== "rejected" && (
                            <DropdownMenuItem onClick={() => setRejecting(r)}>
                              <X className="mr-2 h-4 w-4" /> Reject…
                            </DropdownMenuItem>
                          )}
                          {r.status !== "suspended" && (
                            <DropdownMenuItem onClick={() => review(r, "suspend")}>
                              <X className="mr-2 h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => toggleFeatured(r)}>
                            <Star className="mr-2 h-4 w-4" />{" "}
                            {r.featured ? "Unfeature" : "Feature"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleting(r)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EntryModal entry={editing} onClose={() => setEditing(null)} onSave={save} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.company_name}?`}
          message="This permanently removes the entry from the public directory."
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
      {rejecting && (
        <RejectModal
          entry={rejecting}
          onClose={() => setRejecting(null)}
          onConfirm={async (notes) => {
            await review(rejecting, "reject", notes);
            setRejecting(null);
          }}
        />
      )}
    </AdminShell>
  );
}

function EntryModal({
  entry,
  onClose,
  onSave,
}: {
  entry: Entry;
  onClose: () => void;
  onSave: (e: Entry) => void | Promise<void>;
}) {
  const [e, setE] = useState<Entry>(entry);
  const [uploading, setUploading] = useState(false);

  function update<K extends keyof Entry>(k: K, v: Entry[K]) {
    setE((prev) => ({ ...prev, [k]: v }));
  }

  async function onLogo(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, "directory/logos");
      update("logo_url", url);
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{entry.id ? "Edit entry" : "New entry"}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type">
              <select
                value={e.entry_type}
                onChange={(ev) => update("entry_type", ev.target.value as any)}
                className={inputCls}
              >
                <option value="corporate">Corporate Member</option>
                <option value="association">Association</option>
              </select>
            </FormField>
            <FormField label="Category">
              <input
                value={e.category ?? ""}
                onChange={(ev) => update("category", ev.target.value)}
                placeholder="e.g. Pineapples, Vegetables"
                className={inputCls}
              />
            </FormField>
            <FormField label="Company / Association name">
              <input
                value={e.company_name}
                onChange={(ev) => {
                  update("company_name", ev.target.value);
                  if (!entry.id && !e.slug) update("slug", slugify(ev.target.value));
                }}
                required
                className={inputCls}
              />
            </FormField>
            <FormField label="Slug (URL)">
              <input
                value={e.slug}
                onChange={(ev) => update("slug", slugify(ev.target.value))}
                className={inputCls + " font-mono text-xs"}
              />
            </FormField>
          </div>

          <FormField label="Short description (shown on card)">
            <textarea
              value={e.short_description ?? ""}
              onChange={(ev) => update("short_description", ev.target.value)}
              rows={2}
              className={inputCls}
            />
          </FormField>

          <FormField label="Long description / About">
            <textarea
              value={e.long_description ?? ""}
              onChange={(ev) => update("long_description", ev.target.value)}
              rows={4}
              className={inputCls}
            />
          </FormField>

          {e.entry_type === "association" && (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Mission">
                <textarea
                  value={e.mission ?? ""}
                  onChange={(ev) => update("mission", ev.target.value)}
                  rows={3}
                  className={inputCls}
                />
              </FormField>
              <FormField label="Vision">
                <textarea
                  value={e.vision ?? ""}
                  onChange={(ev) => update("vision", ev.target.value)}
                  rows={3}
                  className={inputCls}
                />
              </FormField>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Products (comma-separated)">
              <input
                value={e.products.join(", ")}
                onChange={(ev) =>
                  update(
                    "products",
                    ev.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className={inputCls}
              />
            </FormField>
            <FormField label="Services (one per line)">
              <textarea
                value={e.services.join("\n")}
                onChange={(ev) =>
                  update(
                    "services",
                    ev.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                rows={3}
                className={inputCls}
              />
            </FormField>
          </div>

          {e.entry_type === "association" && (
            <FormField label="Executives">
              <ExecutivesEditor
                value={e.executives}
                onChange={(v) => update("executives", v)}
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label={e.entry_type === "corporate" ? "Director" : "Contact person"}>
              <input
                value={e.entry_type === "corporate" ? (e.director_name ?? "") : (e.contact_name ?? "")}
                onChange={(ev) =>
                  update(
                    e.entry_type === "corporate" ? "director_name" : "contact_name",
                    ev.target.value,
                  )
                }
                className={inputCls}
              />
            </FormField>
            <FormField label="Phone">
              <input
                value={e.phone ?? ""}
                onChange={(ev) => update("phone", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={e.email ?? ""}
                onChange={(ev) => update("email", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Website">
              <input
                value={e.website ?? ""}
                onChange={(ev) => update("website", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Physical address">
              <input
                value={e.physical_address ?? ""}
                onChange={(ev) => update("physical_address", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Postal address">
              <input
                value={e.postal_address ?? ""}
                onChange={(ev) => update("postal_address", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Region">
              <input
                value={e.region ?? ""}
                onChange={(ev) => update("region", ev.target.value)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Country">
              <input
                value={e.country}
                onChange={(ev) => update("country", ev.target.value)}
                className={inputCls}
              />
            </FormField>
          </div>

          <FormField label="Logo">
            <div className="flex items-center gap-3">
              {e.logo_url && (
                <img src={e.logo_url} alt="logo" className="h-14 w-14 rounded-lg object-cover" />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload logo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(ev) => {
                    const f = ev.target.files?.[0];
                    if (f) void onLogo(f);
                  }}
                />
              </label>
              {e.logo_url && (
                <button
                  type="button"
                  onClick={() => update("logo_url", "")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Display order">
              <input
                type="number"
                value={e.display_order}
                onChange={(ev) => update("display_order", Number(ev.target.value) || 0)}
                className={inputCls}
              />
            </FormField>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={e.featured}
                onChange={(ev) => update("featured", ev.target.checked)}
              />
              Featured
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={e.published}
                onChange={(ev) => update("published", ev.target.checked)}
              />
              Published
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Status">
              <select
                value={e.status}
                onChange={(ev) => update("status", ev.target.value as any)}
                className={inputCls}
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select>
            </FormField>
            <FormField label="Linked member" hint="Entry will appear in this member's dashboard. Required for subscription-gated visibility.">
              <MemberLinkPicker
                value={e.user_id}
                onChange={(v) => update("user_id", v)}
              />
            </FormField>
          </div>

          <CustomFieldsSection
            entryType={e.entry_type}
            value={e.custom_fields ?? {}}
            onChange={(v) => update("custom_fields", v)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(e)}
            disabled={!e.company_name}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ExecutivesEditor({
  value,
  onChange,
}: {
  value: Executive[];
  onChange: (v: Executive[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((x, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={x.role}
            placeholder="Role (e.g. President)"
            onChange={(ev) => {
              const v = [...value];
              v[i] = { ...v[i], role: ev.target.value };
              onChange(v);
            }}
            className={inputCls + " flex-1"}
          />
          <input
            value={x.name}
            placeholder="Full name"
            onChange={(ev) => {
              const v = [...value];
              v[i] = { ...v[i], name: ev.target.value };
              onChange(v);
            }}
            className={inputCls + " flex-1"}
          />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-full p-2 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { role: "", name: "" }])}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
        <Plus className="h-3 w-3" /> Add executive
      </button>
    </div>
  );
}

function CustomFieldsSection({
  entryType,
  value,
  onChange,
}: {
  entryType: "association" | "corporate";
  value: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
}) {
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("directory_custom_field_defs")
        .select("*")
        .eq("active", true)
        .order("display_order");
      setDefs(
        (data ?? []).map((d: any) => ({ ...d, options: d.options ?? [] })) as CustomFieldDef[],
      );
      setLoading(false);
    })();
  }, []);
  const visible = defs.filter(
    (d) => d.applies_to === "both" || d.applies_to === entryType,
  );
  if (loading) return null;
  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
        No custom fields defined.{" "}
        <Link to="/admin/directory-fields" className="text-primary hover:underline">
          Add fields →
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Custom fields</h3>
        <Link
          to="/admin/directory-fields"
          className="text-xs text-primary hover:underline"
        >
          Manage fields
        </Link>
      </div>
      {visible.map((def) => (
        <DynamicFieldRenderer
          key={def.id}
          def={def}
          value={value[def.key]}
          onChange={(v) => onChange({ ...value, [def.key]: v })}
        />
      ))}
    </div>
  );
}


function ConfirmDialog({
  title,
  message,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground"
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberLinkPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [current, setCurrent] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) {
      setCurrent(null);
      return;
    }
    void supabase
      .from("member_profiles")
      .select("user_id, contact_name, email, member_id, company_name")
      .eq("user_id", value)
      .maybeSingle()
      .then(({ data }) => setCurrent(data));
  }, [value]);

  useEffect(() => {
    if (!open || !q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const term = `%${q}%`;
      const { data } = await supabase
        .from("member_profiles")
        .select("user_id, contact_name, email, member_id, company_name")
        .or(
          `contact_name.ilike.${term},email.ilike.${term},member_id.ilike.${term},company_name.ilike.${term}`,
        )
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  return (
    <div className="space-y-2">
      {current ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <div>
            <div className="font-medium">{current.company_name || current.contact_name}</div>
            <div className="text-xs text-muted-foreground">
              {current.email} · {current.member_id ?? "no ID"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Unlink
          </button>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Not linked to a member</div>
      )}
      <div className="relative">
        <input
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search members by name, email, ID…"
          className={inputCls}
        />
        {open && results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
            {results.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => {
                  onChange(m.user_id);
                  setOpen(false);
                  setQ("");
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="font-medium">{m.company_name || m.contact_name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.email} · {m.member_id ?? "no ID"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RejectModal({
  entry,
  onClose,
  onConfirm,
}: {
  entry: Entry;
  onClose: () => void;
  onConfirm: (notes: string) => void | Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <h2 className="text-lg font-bold">Reject "{entry.company_name}"?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The member will see your feedback in their dashboard.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Reason for rejection (optional)…"
          className={inputCls + " mt-3"}
        />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => void onConfirm(notes)}
            className="rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground"
          >
            Reject entry
          </button>
        </div>
      </div>
    </div>
  );
}
