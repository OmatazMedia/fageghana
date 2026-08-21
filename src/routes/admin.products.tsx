import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { uploadImage } from "@/lib/uploadImage";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Manage Products — FAGE Admin" }] }),
  component: ProductsAdmin,
});

type ProductRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  features: string[];
  image_url: string | null;
  display_order: number;
  published: boolean;
};

const empty: Omit<ProductRow, "id"> = {
  name: "",
  description: "",
  category: "Fresh Produce",
  features: [],
  image_url: "",
  display_order: 0,
  published: true,
};

function ProductsAdmin() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("display_order")
      .order("name");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as ProductRow[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  return (
    <AdminShell
      title="Products"
      description="Manage the products displayed on the public site."
      action={
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> New product
        </button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">No products yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              {r.image_url && (
                <img src={r.image_url} alt={r.name} className="h-40 w-full object-cover" />
              )}
              <div className="p-4">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-primary">
                  {r.category}
                </div>
                <h3 className="font-bold">{r.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {r.published ? "Published" : "Draft"}
                  </span>
                  <div>
                    <button
                      onClick={() => setEditing(r)}
                      className="mr-1 rounded p-1.5 hover:bg-accent"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductEditor
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

function ProductEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: ProductRow;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductRow>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [featuresText, setFeaturesText] = useState(initial.features.join("\n"));

  function update<K extends keyof ProductRow>(key: K, value: ProductRow[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "products");
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
    const features = featuresText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      name: form.name,
      description: form.description,
      category: form.category,
      features,
      image_url: form.image_url || null,
      display_order: form.display_order,
      published: form.published,
    };
    const { error } = isNew
      ? await supabase.from("products").insert(payload)
      : await supabase.from("products").update(payload).eq("id", form.id);
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
          <h2 className="text-xl font-bold">{isNew ? "New product" : "Edit product"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <FormField label="Name">
            <input
              required
              className={inputCls}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
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
            <FormField label="Display order">
              <input
                type="number"
                className={inputCls}
                value={form.display_order}
                onChange={(e) => update("display_order", parseInt(e.target.value) || 0)}
              />
            </FormField>
          </div>
          <FormField label="Description">
            <textarea
              rows={4}
              className={inputCls}
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </FormField>
          <FormField label="Features" hint="One per line.">
            <textarea
              rows={4}
              className={inputCls}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
            />
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
