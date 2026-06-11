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
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);

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
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        r.company_name.toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.category ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, q, type]);

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
      </div>

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
                      <button
                        onClick={() => togglePublished(r)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${r.published ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                      >
                        {r.published ? "Published" : "Hidden"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setEditing(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
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
