import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";

export const Route = createFileRoute("/admin/media")({
  head: () => ({ meta: [{ title: "Manage Media — FAGE Admin" }] }),
  component: MediaAdmin,
});

type MediaRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  media_type: "photo" | "video";
  url: string;
  thumbnail_url: string | null;
  published: boolean;
};

const empty: Omit<MediaRow, "id"> = {
  title: "",
  description: "",
  category: "General",
  media_type: "photo",
  url: "",
  thumbnail_url: "",
  published: true,
};

function MediaAdmin() {
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MediaRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("media")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as MediaRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this item?")) return;
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  return (
    <AdminShell
      title="Media"
      description="Photos and videos for the gallery."
      action={
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New item
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No media yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-video bg-muted">
                {(r.thumbnail_url || (r.media_type === "photo" && r.url)) && (
                  <img
                    src={r.thumbnail_url || r.url}
                    alt={r.title}
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs">
                  {r.media_type}
                </span>
              </div>
              <div className="p-3">
                <h3 className="truncate text-sm font-bold">{r.title}</h3>
                <p className="truncate text-xs text-muted-foreground">{r.category}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {r.published ? "Live" : "Draft"}
                  </span>
                  <div>
                    <button
                      onClick={() => setEditing(r)}
                      className="mr-1 rounded p-1 hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <MediaEditor
          initial={editing ?? { id: "", ...empty }}
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
    </AdminShell>
  );
}

function MediaEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: MediaRow;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MediaRow>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function update<K extends keyof MediaRow>(key: K, value: MediaRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    field: "url" | "thumbnail_url",
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "media");
      update(field, url);
      toast.success("Uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      media_type: form.media_type,
      url: form.url,
      thumbnail_url: form.thumbnail_url || null,
      published: form.published,
    };
    const { error } = isNew
      ? await supabase.from("media").insert(payload)
      : await supabase.from("media").update(payload).eq("id", form.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isNew ? "Created" : "Updated");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4 backdrop-blur">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isNew ? "New media" : "Edit media"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Title">
            <input
              required
              className={inputCls}
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Type">
              <select
                className={inputCls}
                value={form.media_type}
                onChange={(e) => update("media_type", e.target.value as "photo" | "video")}
              >
                <option value="photo">Photo</option>
                <option value="video">Video</option>
              </select>
            </FormField>
            <FormField label="Category">
              <input
                className={inputCls}
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </FormField>
          </div>
          <FormField
            label={form.media_type === "video" ? "Video URL (YouTube/Vimeo)" : "Image URL"}
          >
            <div className="flex items-center gap-3">
              <input
                required
                className={inputCls}
                value={form.url}
                onChange={(e) => update("url", e.target.value)}
              />
              {form.media_type === "photo" && (
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent whitespace-nowrap">
                  <Upload className="h-4 w-4" />
                  {uploading ? "…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "url")}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </FormField>
          {form.media_type === "video" && (
            <FormField label="Thumbnail (optional)">
              <div className="flex items-center gap-3">
                <input
                  className={inputCls}
                  value={form.thumbnail_url ?? ""}
                  onChange={(e) => update("thumbnail_url", e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent whitespace-nowrap">
                  <Upload className="h-4 w-4" />
                  {uploading ? "…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleUpload(e, "thumbnail_url")}
                    disabled={uploading}
                  />
                </label>
              </div>
            </FormField>
          )}
          <FormField label="Description">
            <textarea
              rows={3}
              className={inputCls}
              value={form.description ?? ""}
              onChange={(e) => update("description", e.target.value)}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
            />{" "}
            Published
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
