import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Upload,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Quote,
  Heading1,
  Heading2,
  Tag,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExt from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import LinkExt from "@tiptap/extension-link";
import ImageExt from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { supabase } from "@/integrations/api/client";
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
  category: "",
  author: "FAGE Admin",
  cover_image_url: "",
  published: true,
  published_at: new Date().toISOString(),
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Category Manager ──────────────────────────────────────────────────────
function CategoryManager({ onClose }: { onClose: () => void }) {
  const [cats, setCats] = useState<string[]>([]);
  const [newCat, setNewCat] = useState("");

  useEffect(() => {
    void supabase
      .from("news")
      .select("category")
      .eq("published", true)
      .then(({ data }) => {
        const unique = Array.from(
          new Set((data ?? []).map((r: any) => r.category).filter(Boolean)),
        ) as string[];
        setCats(unique);
      });
  }, []);

  async function add() {
    const v = newCat.trim();
    if (!v || cats.includes(v)) return;
    setCats((c) => [...c, v]);
    setNewCat("");
    toast.success(`Category "${v}" added — it will appear once an article uses it.`);
  }

  async function remove(cat: string) {
    if (
      !confirm(
        `Remove category "${cat}"? Articles using it will keep the value but it won't appear in the dropdown.`,
      )
    )
      return;
    setCats((c) => c.filter((x) => x !== cat));
    toast.success(`"${cat}" removed from dropdown.`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Manage Categories
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="New category name…"
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={add}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white cursor-pointer"
          >
            Add
          </button>
        </div>
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {cats.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
          )}
          {cats.map((c) => (
            <li
              key={c}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">{c}</span>
              <button
                onClick={() => remove(c)}
                className="text-destructive hover:bg-destructive/10 rounded p-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── TipTap Toolbar ────────────────────────────────────────────────────────
function Toolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded p-1.5 transition cursor-pointer ${active ? "bg-primary text-white" : "hover:bg-accent text-foreground"}`}
    >
      {icon}
    </button>
  );

  function addLink() {
    const url = prompt("Enter URL:");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  function addImage() {
    const url = prompt("Enter image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1.5">
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        <Bold className="h-4 w-4" />,
        "Bold",
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <Italic className="h-4 w-4" />,
        "Italic",
      )}
      {btn(
        editor.isActive("underline"),
        () => editor.chain().focus().toggleUnderline().run(),
        <UnderlineIcon className="h-4 w-4" />,
        "Underline",
      )}
      <div className="mx-1 h-5 w-px bg-border" />
      {btn(
        editor.isActive("heading", { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        <Heading1 className="h-4 w-4" />,
        "Heading 1",
      )}
      {btn(
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 className="h-4 w-4" />,
        "Heading 2",
      )}
      <div className="mx-1 h-5 w-px bg-border" />
      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <List className="h-4 w-4" />,
        "Bullet list",
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered className="h-4 w-4" />,
        "Ordered list",
      )}
      {btn(
        editor.isActive("blockquote"),
        () => editor.chain().focus().toggleBlockquote().run(),
        <Quote className="h-4 w-4" />,
        "Blockquote",
      )}
      <div className="mx-1 h-5 w-px bg-border" />
      {btn(
        editor.isActive({ textAlign: "left" }),
        () => editor.chain().focus().setTextAlign("left").run(),
        <AlignLeft className="h-4 w-4" />,
        "Align left",
      )}
      {btn(
        editor.isActive({ textAlign: "center" }),
        () => editor.chain().focus().setTextAlign("center").run(),
        <AlignCenter className="h-4 w-4" />,
        "Align center",
      )}
      {btn(
        editor.isActive({ textAlign: "right" }),
        () => editor.chain().focus().setTextAlign("right").run(),
        <AlignRight className="h-4 w-4" />,
        "Align right",
      )}
      <div className="mx-1 h-5 w-px bg-border" />
      {btn(editor.isActive("link"), addLink, <LinkIcon className="h-4 w-4" />, "Add link")}
      {btn(false, addImage, <ImageIcon className="h-4 w-4" />, "Add image")}
    </div>
  );
}

// ── Main admin page ───────────────────────────────────────────────────────
function NewsAdmin() {
  const [rows, setRows] = useState<NewsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCatMgr, setShowCatMgr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("news")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data ?? []) as NewsRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("news").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  return (
    <AdminShell
      title="News"
      description="Create and manage news articles and blog posts."
      action={
        <div className="flex gap-2">
          <button
            onClick={() => setShowCatMgr(true)}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent cursor-pointer"
          >
            <Tag className="h-4 w-4" /> Categories
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New article
          </button>
        </div>
      }
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
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${r.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.published_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      className="mr-2 rounded p-1.5 hover:bg-accent cursor-pointer"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="rounded p-1.5 text-destructive hover:bg-destructive/10 cursor-pointer"
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
        <NewsEditor
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

      {showCatMgr && <CategoryManager onClose={() => setShowCatMgr(false)} />}
    </AdminShell>
  );
}

// ── News Editor with TipTap ───────────────────────────────────────────────
function NewsEditor({
  initial,
  isNew,
  onClose,
  onSaved,
}: {
  initial: NewsRow;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<NewsRow>(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Load categories from existing news
  useEffect(() => {
    void supabase
      .from("news")
      .select("category")
      .then(({ data }) => {
        const unique = Array.from(
          new Set((data ?? []).map((r: any) => r.category).filter(Boolean)),
        ) as string[];
        setCategories(unique);
      });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExt,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExt.configure({ openOnClick: false }),
      ImageExt,
      Placeholder.configure({ placeholder: "Write your article content here…" }),
    ],
    content: initial.body || "",
    onUpdate: ({ editor }) => setForm((f) => ({ ...f, body: editor.getHTML() })),
  });

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
    else {
      toast.success(isNew ? "Article created" : "Article updated");
      onSaved();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-background/80 p-4 backdrop-blur">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isNew ? "New article" : "Edit article"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={save} className="space-y-5">
          <FormField label="Title">
            <input
              required
              className={inputCls}
              value={form.title}
              onChange={(e) => {
                update("title", e.target.value);
                if (isNew && !form.slug) update("slug", slugify(e.target.value));
              }}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Slug">
              <input
                required
                className={inputCls}
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
              />
            </FormField>
            <FormField label="Category">
              <div className="flex gap-2">
                <select
                  className={`${inputCls} flex-1`}
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                >
                  <option value="">— Select category —</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {/* Allow typing a new one inline */}
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Or type new…"
                  value={categories.includes(form.category) ? "" : form.category}
                  onChange={(e) => update("category", e.target.value)}
                />
              </div>
            </FormField>
          </div>

          <FormField label="Excerpt" hint="Short summary shown in listings.">
            <textarea
              rows={2}
              className={inputCls}
              value={form.excerpt ?? ""}
              onChange={(e) => update("excerpt", e.target.value)}
            />
          </FormField>

          {/* Rich text editor */}
          <FormField label="Body">
            <div className="tiptap-editor overflow-hidden rounded-xl border border-input bg-background">
              <Toolbar editor={editor} />
              <EditorContent editor={editor} />
            </div>
          </FormField>

          <FormField label="Cover image">
            <div className="flex flex-wrap items-center gap-3">
              {form.cover_image_url && (
                <img src={form.cover_image_url} alt="" className="h-16 w-24 rounded object-cover" />
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
                className={`${inputCls} flex-1`}
                placeholder="…or paste URL"
                value={form.cover_image_url ?? ""}
                onChange={(e) => update("cover_image_url", e.target.value)}
              />
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Author">
              <input
                className={inputCls}
                value={form.author}
                onChange={(e) => update("author", e.target.value)}
              />
            </FormField>
            <FormField label="Publish date">
              <input
                type="datetime-local"
                className={inputCls}
                value={form.published_at.slice(0, 16)}
                onChange={(e) => update("published_at", new Date(e.target.value).toISOString())}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
            />
            Published (visible to public)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
            >
              {busy ? "Saving…" : "Save article"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
