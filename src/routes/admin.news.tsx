import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";

export const Route = createFileRoute("/admin/news")({
  head: () => ({ meta: [{ title: "Manage News — FAGE Admin" }] }),
  component: NewsAdmin,
});

type NewsRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  category: string;
  author: string;
  cover_image_url: string | null;
  published: boolean;
  published_at: string;
};

const empty: Omit<NewsRow, "id"> = {
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  category: "Industry News",
  author: "FAGE Admin",
  cover_image_url: "",
  published: true,
  published_at: new Date().toISOString(),
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function NewsAdmin() {
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("news").select("*").order("published_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as NewsRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function remove(id: string) {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("news").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); void load(); }
  }

  return (
    <AdminShell
      title="News"
      description="Create and manage news articles."
      action={<button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> New article</button>}
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No articles yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.published ? "Published" : "Draft"}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(r.published_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(r)} className="mr-2 rounded p-1.5 hover:bg-accent"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(r.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <NewsEditor
          initial={editing ?? { id: "", ...empty }}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); void load(); }}
        />
      )}
    </AdminShell>
  );
}

function NewsEditor({ initial, isNew, onClose, onSaved }: { initial: NewsRow; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<NewsRow>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function update<K extends keyof NewsRow>(key: K, value: NewsRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "news");
      update("cover_image_url", url);
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
      slug: form.slug || slugify(form.title),
      excerpt: form.excerpt,
      body: form.body,
      category: form.category,
      author: form.author,
      cover_image_url: form.cover_image_url || null,
      published: form.published,
      published_at: form.published_at,
    };
    const { error } = isNew
      ? await supabase.from("news").insert(payload)
      : await supabase.from("news").update(payload).eq("id", form.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(isNew ? "Article created" : "Article updated"); onSaved(); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4 backdrop-blur">
      <div className="my-8 w-full max-w-3xl rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isNew ? "New article" : "Edit article"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Title">
            <input required className={inputCls} value={form.title} onChange={(e) => { update("title", e.target.value); if (isNew && !form.slug) update("slug", slugify(e.target.value)); }} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Slug">
              <input required className={inputCls} value={form.slug} onChange={(e) => update("slug", e.target.value)} />
            </FormField>
            <FormField label="Category">
              <input className={inputCls} value={form.category} onChange={(e) => update("category", e.target.value)} />
            </FormField>
          </div>
          <FormField label="Excerpt" hint="Short summary shown in lists.">
            <textarea rows={2} className={inputCls} value={form.excerpt ?? ""} onChange={(e) => update("excerpt", e.target.value)} />
          </FormField>
          <FormField label="Body" hint="Plain text. Paragraphs are separated by blank lines.">
            <textarea rows={10} className={inputCls} value={form.body} onChange={(e) => update("body", e.target.value)} />
          </FormField>
          <FormField label="Cover image">
            <div className="flex items-center gap-3">
              {form.cover_image_url && <img src={form.cover_image_url} alt="" className="h-16 w-24 rounded object-cover" />}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
              <input className={inputCls} placeholder="…or paste URL" value={form.cover_image_url ?? ""} onChange={(e) => update("cover_image_url", e.target.value)} />
            </div>
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Author">
              <input className={inputCls} value={form.author} onChange={(e) => update("author", e.target.value)} />
            </FormField>
            <FormField label="Publish date">
              <input type="datetime-local" className={inputCls} value={form.published_at.slice(0, 16)} onChange={(e) => update("published_at", new Date(e.target.value).toISOString())} />
            </FormField>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.published} onChange={(e) => update("published", e.target.checked)} />
            Published (visible to public)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm hover:bg-accent">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
