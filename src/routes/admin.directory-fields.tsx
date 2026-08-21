import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import type { CustomFieldDef } from "@/components/admin/DynamicFieldRenderer";

export const Route = createFileRoute("/admin/directory-fields")({
  head: () => ({ meta: [{ title: "Directory Fields — Admin" }] }),
  component: DirectoryFieldsAdmin,
});

const FIELD_TYPES: CustomFieldDef["field_type"][] = [
  "text",
  "textarea",
  "number",
  "email",
  "url",
  "phone",
  "dropdown",
  "radio",
  "checkboxes",
  "image",
  "file",
];

const blank: CustomFieldDef = {
  id: "",
  key: "",
  label: "",
  field_type: "text",
  options: [],
  required: false,
  help_text: "",
  applies_to: "both",
  display_order: 0,
  active: true,
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function DirectoryFieldsAdmin() {
  const [rows, setRows] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CustomFieldDef | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("directory_custom_field_defs")
      .select("*")
      .order("display_order")
      .order("created_at");
    if (error) toast.error(error.message);
    else setRows((data ?? []).map((r: any) => ({ ...r, options: r.options ?? [] })));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save(def: CustomFieldDef) {
    const payload = {
      key: def.key || slugify(def.label),
      label: def.label,
      field_type: def.field_type,
      options: ["dropdown", "radio", "checkboxes"].includes(def.field_type) ? def.options : [],
      required: def.required,
      help_text: def.help_text || null,
      applies_to: def.applies_to,
      display_order: def.display_order,
      active: def.active,
    };
    const res = def.id
      ? await supabase.from("directory_custom_field_defs").update(payload).eq("id", def.id)
      : await supabase.from("directory_custom_field_defs").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(def.id ? "Field updated" : "Field added");
    setEditing(null);
    void load();
  }

  async function remove(def: CustomFieldDef) {
    if (!confirm(`Delete field "${def.label}"? Existing data in entries is kept.`)) return;
    const { error } = await supabase
      .from("directory_custom_field_defs")
      .delete()
      .eq("id", def.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void load();
    }
  }

  async function move(def: CustomFieldDef, dir: -1 | 1) {
    const { error } = await supabase
      .from("directory_custom_field_defs")
      .update({ display_order: def.display_order + dir })
      .eq("id", def.id);
    if (error) toast.error(error.message);
    else void load();
  }

  async function toggleActive(def: CustomFieldDef) {
    const { error } = await supabase
      .from("directory_custom_field_defs")
      .update({ active: !def.active })
      .eq("id", def.id);
    if (error) toast.error(error.message);
    else void load();
  }

  return (
    <AdminShell
      title="Directory Form Fields"
      description="Add custom fields shown in the directory entry form. New fields are stored in JSON and automatically included in backups — no code or migration needed."
      action={
        <button
          onClick={() => setEditing(blank)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add field
        </button>
      }
    >
      <div className="rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Applies to</th>
              <th className="px-4 py-3">Active</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No custom fields yet. Click "Add field" to define one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">{r.display_order}</span>
                      <button
                        onClick={() => move(r, -1)}
                        className="rounded p-1 hover:bg-muted"
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => move(r, 1)}
                        className="rounded p-1 hover:bg-muted"
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.label}</div>
                    {r.required && (
                      <span className="text-xs text-primary">Required</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.key}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{r.field_type}</span>
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.applies_to}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(r)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.active ? "Active" : "Hidden"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(r)}
                      className="mr-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-muted"
                    >
                      <Pencil className="inline h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="rounded-full border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="inline h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <FieldModal def={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </AdminShell>
  );
}

function FieldModal({
  def,
  onClose,
  onSave,
}: {
  def: CustomFieldDef;
  onClose: () => void;
  onSave: (d: CustomFieldDef) => void;
}) {
  const [d, setD] = useState<CustomFieldDef>(def);
  function update<K extends keyof CustomFieldDef>(k: K, v: CustomFieldDef[K]) {
    setD((p) => ({ ...p, [k]: v }));
  }
  const hasOptions = ["dropdown", "radio", "checkboxes"].includes(d.field_type);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{def.id ? "Edit field" : "Add field"}</h2>
          <button onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Label">
              <input
                value={d.label}
                onChange={(e) => {
                  update("label", e.target.value);
                  if (!def.id && !d.key) update("key", slugify(e.target.value));
                }}
                className={inputCls}
                required
              />
            </FormField>
            <FormField label="Storage key" hint="Lowercase, underscores. Avoid changing later.">
              <input
                value={d.key}
                onChange={(e) => update("key", slugify(e.target.value))}
                className={inputCls + " font-mono text-xs"}
              />
            </FormField>
            <FormField label="Field type">
              <select
                value={d.field_type}
                onChange={(e) => update("field_type", e.target.value as any)}
                className={inputCls}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Applies to">
              <select
                value={d.applies_to}
                onChange={(e) => update("applies_to", e.target.value as any)}
                className={inputCls}
              >
                <option value="both">Both</option>
                <option value="association">Associations only</option>
                <option value="corporate">Corporate members only</option>
              </select>
            </FormField>
          </div>

          <FormField label="Help text (optional)">
            <input
              value={d.help_text ?? ""}
              onChange={(e) => update("help_text", e.target.value)}
              className={inputCls}
            />
          </FormField>

          {hasOptions && (
            <FormField label="Options (one per line)">
              <textarea
                value={d.options.join("\n")}
                onChange={(e) =>
                  update(
                    "options",
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  )
                }
                rows={5}
                className={inputCls}
              />
            </FormField>
          )}

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Display order">
              <input
                type="number"
                value={d.display_order}
                onChange={(e) => update("display_order", Number(e.target.value) || 0)}
                className={inputCls}
              />
            </FormField>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={d.required}
                onChange={(e) => update("required", e.target.checked)}
              />
              Required
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={d.active}
                onChange={(e) => update("active", e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSave(d)}
            disabled={!d.label}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
