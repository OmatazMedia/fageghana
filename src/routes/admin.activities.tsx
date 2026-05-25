import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";

export const Route = createFileRoute("/admin/activities")({
  head: () => ({ meta: [{ title: "Manage Activities — FAGE Admin" }] }),
  component: ActivitiesAdmin,
});

type ActivityRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  event_date: string | null;
  location: string | null;
  image_url: string | null;
  spots_remaining: number | null;
  is_featured: boolean;
  published: boolean;
  register_button_link: string | null;
  register_button_text: string | null;
  view_count: number | null;
};

const empty: Omit<ActivityRow, "id"> = {
  title: "",
  description: "",
  category: "Event",
  event_date: null,
  location: "",
  image_url: "",
  spots_remaining: null,
  is_featured: false,
  published: true,
  register_button_link: "",
  register_button_text: "Register",
  view_count: 0,
};

function ActivitiesAdmin() {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("activities")
      .select("*")
      .order("event_date", { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as ActivityRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this activity?")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  return (
    <AdminShell
      title="Event & Activities"
      description="Manage events and activities."
      action={
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New activity
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No activities yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.event_date ? new Date(r.event_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.location || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.published ? "Published" : "Draft"}
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
        <ActivityEditor
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

function ActivityEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: ActivityRow;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ActivityRow>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function update<K extends keyof ActivityRow>(key: K, value: ActivityRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "activities");
      update("image_url", url);
      toast.success("Image uploaded");
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
      event_date: form.event_date,
      location: form.location || null,
      image_url: form.image_url || null,
      spots_remaining: form.spots_remaining,
      is_featured: form.is_featured,
      published: form.published,
      register_button_link: form.register_button_link || null,
      register_button_text: form.register_button_text || null,
    };
    const { error } = isNew
      ? await supabase.from("activities").insert(payload)
      : await supabase.from("activities").update(payload).eq("id", form.id);
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
          <h2 className="text-xl font-bold">{isNew ? "New activity" : "Edit activity"}</h2>
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
            <FormField label="Category">
              <input
                className={inputCls}
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
              />
            </FormField>
            <FormField label="Event date">
              <input
                type="datetime-local"
                className={inputCls}
                value={form.event_date ? form.event_date.slice(0, 16) : ""}
                onChange={(e) =>
                  update(
                    "event_date",
                    e.target.value ? new Date(e.target.value).toISOString() : null,
                  )
                }
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Location">
              <input
                className={inputCls}
                value={form.location ?? ""}
                onChange={(e) => update("location", e.target.value)}
              />
            </FormField>
            <FormField label="Spots remaining">
              <input
                type="number"
                className={inputCls}
                value={form.spots_remaining ?? ""}
                onChange={(e) =>
                  update("spots_remaining", e.target.value ? parseInt(e.target.value) : null)
                }
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              rows={5}
              className={inputCls}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </FormField>
          <FormField label="Image">
            <div className="flex items-center gap-3">
              {form.image_url && (
                <img src={form.image_url} alt="" className="h-16 w-24 rounded object-cover" />
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
              <input
                className={inputCls}
                placeholder="…or paste URL"
                value={form.image_url ?? ""}
                onChange={(e) => update("image_url", e.target.value)}
              />
            </div>
          </FormField>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => update("is_featured", e.target.checked)}
              />{" "}
              Featured
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => update("published", e.target.checked)}
              />{" "}
              Published
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Register Button Link">
              <input
                className={inputCls}
                placeholder="https://..."
                value={form.register_button_link ?? ""}
                onChange={(e) => update("register_button_link", e.target.value)}
              />
            </FormField>
            <FormField label="Register Button Text">
              <input
                className={inputCls}
                placeholder="Register"
                value={form.register_button_text ?? ""}
                onChange={(e) => update("register_button_text", e.target.value)}
              />
            </FormField>
          </div>
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
