import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, Upload, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { uploadImage } from "@/lib/uploadImage";

export const Route = createFileRoute("/admin/resources")({
  head: () => ({ meta: [{ title: "Membership Resources — Admin" }] }),
  component: ResourcesAdmin,
});

type Resource = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  body: string | null;
  cover_image_url: string | null;
  file_url: string | null;
  external_url: string | null;
  min_tier: string | null;
  published: boolean;
  display_order: number;
};

const blank: Resource = {
  id: "",
  title: "",
  slug: "",
  category: "",
  description: "",
  body: "",
  cover_image_url: "",
  file_url: "",
  external_url: "",
  min_tier: "",
  published: true,
  display_order: 0,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ResourcesAdmin() {
  const [rows, setRows] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Resource | null>(null);
  const [deleting, setDeleting] = useState<Resource | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("membership_resources")
      .select("*")
      .order("display_order")
      .order("title");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Resource[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        (r.category ?? "").toLowerCase().includes(s),
    );
  }, [rows, q]);

  async function togglePub(r: Resource) {
    const { error } = await supabase
      .from("membership_resources")
      .update({ published: !r.published })
      .eq("id", r.id);
    if (error) toast.error(error.message);
    else {
      toast.success(r.published ? "Unpublished" : "Published");
      setRows((rs) =>
        rs.map((x) => (x.id === r.id ? { ...x, published: !x.published } : x)),
      );
    }
  }

  async function save(r: Resource) {
    const payload = {
      title: r.title,
      slug: r.slug || slugify(r.title),
      category: r.category || null,
      description: r.description || null,
      body: r.body || null,
      cover_image_url: r.cover_image_url || null,
      file_url: r.file_url || null,
      external_url: r.external_url || null,
      min_tier: r.min_tier || null,
      published: r.published,
      display_order: r.display_order,
    };
    const res = r.id
      ? await supabase.from("membership_resources").update(payload).eq("id", r.id)
      : await supabase.from("membership_resources").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(r.id ? "Resource updated" : "Resource created");
    setEditing(null);
    await load();
  }

  async function confirmDelete() {
    if (!deleting) return;
    const { error } = await supabase
      .from("membership_resources")
      .delete()
      .eq("id", deleting.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      setDeleting(null);
      await load();
    }
  }

  return (
    <AdminShell
      title="Membership Resources"
      description="Guides, downloads, and links shown on the member dashboard Resources tab."
      action={
        <button
          onClick={() => setEditing({ ...blank })}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New resource
        </button>
      }
    >
      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search resources…"
          className={inputCls + " max-w-md"}
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Min tier</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No resources yet
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.category ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {r.min_tier ?? "all"}
                    </td>
                    <td className="px-4 py-3">{r.display_order}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePub(r)}
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
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => setEditing(r)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
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

      {editing && <EditModal r={editing} onClose={() => setEditing(null)} onSave={save} />}
      {deleting && (
        <ConfirmModal
          title={`Delete "${deleting.title}"?`}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </AdminShell>
  );
}

function EditModal({
  r,
  onClose,
  onSave,
}: {
  r: Resource;
  onClose: () => void;
  onSave: (r: Resource) => void | Promise<void>;
}) {
  const [v, setV] = useState<Resource>(r);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  function up<K extends keyof Resource>(k: K, val: Resource[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function uploadCover(file: File) {
    setUploadingCover(true);
    try {
      const url = await uploadImage(file, "resources/covers");
      up("cover_image_url", url);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingCover(false);
    }
  }

  async function uploadFile(file: File) {
    setUploadingFile(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `resources/files/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("content").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("content").getPublicUrl(path);
      up("file_url", data.publicUrl);
      toast.success("File uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploadingFile(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{r.id ? "Edit resource" : "New resource"}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Title *">
              <input
                value={v.title}
                onChange={(e) => {
                  up("title", e.target.value);
                  if (!r.id && !v.slug) up("slug", slugify(e.target.value));
                }}
                className={inputCls}
                required
              />
            </FormField>
            <FormField label="Slug">
              <input
                value={v.slug}
                onChange={(e) => up("slug", slugify(e.target.value))}
                className={inputCls + " font-mono text-xs"}
              />
            </FormField>
            <FormField label="Category" hint="Used to group cards on the dashboard">
              <input
                value={v.category ?? ""}
                onChange={(e) => up("category", e.target.value)}
                placeholder="e.g. Export Guides"
                className={inputCls}
              />
            </FormField>
            <FormField label="Minimum tier">
              <select
                value={v.min_tier ?? ""}
                onChange={(e) => up("min_tier", e.target.value || null)}
                className={inputCls}
              >
                <option value="">All members</option>
                <option value="associate">Associate +</option>
                <option value="standard">Standard +</option>
                <option value="corporate">Corporate only</option>
              </select>
            </FormField>
          </div>

          <FormField label="Short description">
            <textarea
              value={v.description ?? ""}
              onChange={(e) => up("description", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </FormField>

          <FormField label="Long body (optional)">
            <textarea
              value={v.body ?? ""}
              onChange={(e) => up("body", e.target.value)}
              rows={4}
              className={inputCls}
            />
          </FormField>

          <FormField label="Cover image">
            <div className="flex items-center gap-3">
              {v.cover_image_url && (
                <img
                  src={v.cover_image_url}
                  alt=""
                  className="h-14 w-20 rounded-lg object-cover"
                />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploadingCover ? "Uploading…" : v.cover_image_url ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadCover(f);
                  }}
                />
              </label>
              {v.cover_image_url && (
                <button
                  type="button"
                  onClick={() => up("cover_image_url", "")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </FormField>

          <FormField label="Downloadable file">
            <div className="flex items-center gap-3">
              {v.file_url && (
                <a
                  href={v.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm text-primary hover:underline"
                >
                  Current file
                </a>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" />
                {uploadingFile ? "Uploading…" : v.file_url ? "Replace" : "Upload file"}
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadFile(f);
                  }}
                />
              </label>
              {v.file_url && (
                <button
                  type="button"
                  onClick={() => up("file_url", "")}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
          </FormField>

          <FormField label="External URL (alternative to file)">
            <input
              value={v.external_url ?? ""}
              onChange={(e) => up("external_url", e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Display order">
              <input
                type="number"
                value={v.display_order}
                onChange={(e) => up("display_order", Number(e.target.value) || 0)}
                className={inputCls}
              />
            </FormField>
            <FormField label="Published">
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={v.published}
                  onChange={(e) => up("published", e.target.checked)}
                />
                Visible to members
              </label>
            </FormField>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(v)}
            className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  onClose,
  onConfirm,
}: {
  title: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6">
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">This action cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
