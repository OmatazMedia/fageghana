import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DndContext, closestCenter, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/forms")({
  head: () => ({ meta: [{ title: "Application Forms — Admin" }] }),
  component: FormsPage,
});

type Field = {
  id: string; type: string; label: string; name: string;
  required?: boolean; placeholder?: string; help?: string; options?: string[];
};

const FIELD_TYPES = [
  { type: "text", label: "Short text" },
  { type: "paragraph", label: "Paragraph" },
  { type: "number", label: "Number" },
  { type: "email", label: "Email" },
  { type: "phone", label: "Phone" },
  { type: "date", label: "Date" },
  { type: "select", label: "Dropdown" },
  { type: "radio", label: "Radio group" },
  { type: "checkboxes", label: "Checkbox group" },
  { type: "checkbox", label: "Single checkbox" },
  { type: "file", label: "File upload" },
  { type: "heading", label: "Section heading" },
];

function uid() { return Math.random().toString(36).slice(2, 10); }

function defaultField(type: string): Field {
  const id = uid();
  return {
    id, type, label: FIELD_TYPES.find(f => f.type === type)?.label ?? "Field",
    name: `field_${id}`,
    options: ["select","radio","checkboxes"].includes(type) ? ["Option 1","Option 2"] : undefined,
  };
}

function FormsPage() {
  const [tier, setTier] = useState<"associate"|"standard"|"corporate">("associate");
  const [form, setForm] = useState<{ id?: string; schema: Field[]; published: boolean } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("application_forms").select("*").eq("tier", tier).maybeSingle();
    if (data) setForm({ id: data.id, schema: (data.schema as Field[]) ?? [], published: data.published });
    else setForm({ schema: [], published: true });
    setSelected(null);
  }
  useEffect(() => { void load(); }, [tier]);

  async function save() {
    if (!form) return;
    const payload = { tier, schema: form.schema as any, published: form.published };
    const { error } = form.id
      ? await supabase.from("application_forms").update(payload).eq("id", form.id)
      : await supabase.from("application_forms").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Form saved");
    await load();
  }

  function addField(type: string) {
    if (!form) return;
    const f = defaultField(type);
    setForm({ ...form, schema: [...form.schema, f] });
    setSelected(f.id);
  }
  function updateField(id: string, patch: Partial<Field>) {
    if (!form) return;
    setForm({ ...form, schema: form.schema.map(f => f.id === id ? { ...f, ...patch } : f) });
  }
  function removeField(id: string) {
    if (!form) return;
    setForm({ ...form, schema: form.schema.filter(f => f.id !== id) });
    if (selected === id) setSelected(null);
  }
  function onDragEnd(e: DragEndEvent) {
    if (!form || !e.over) return;
    if (e.active.id === e.over.id) return;
    const oldIdx = form.schema.findIndex(f => f.id === e.active.id);
    const newIdx = form.schema.findIndex(f => f.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    setForm({ ...form, schema: arrayMove(form.schema, oldIdx, newIdx) });
  }

  const selField = form?.schema.find(f => f.id === selected) ?? null;

  return (
    <AdminShell title="Application Form Builder" description="Drag fields onto the canvas. Reorder by dragging the handle. Click a field to edit its properties."
      action={<button onClick={save} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"><Save className="h-4 w-4" /> Save form</button>}>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(["associate","standard","corporate"] as const).map(t => (
            <button key={t} onClick={() => setTier(t)} className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${tier === t ? "bg-primary text-primary-foreground" : ""}`}>{t}</button>
          ))}
        </div>
        {form && <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> Published</label>}
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_280px]">
          {/* Palette */}
          <div className="space-y-1 rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add field</p>
            {FIELD_TYPES.map(t => (
              <button key={t.type} onClick={() => addField(t.type)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" /> {t.label}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <Canvas form={form} selected={selected} onSelect={setSelected} onRemove={removeField} />

          {/* Inspector */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Field properties</p>
            {!selField ? <p className="text-sm text-muted-foreground">Select a field to edit.</p> : (
              <div className="space-y-3">
                <FormField label="Label"><input value={selField.label} onChange={(e) => updateField(selField.id, { label: e.target.value })} className={inputCls} /></FormField>
                <FormField label="Field name (key)"><input value={selField.name} onChange={(e) => updateField(selField.id, { name: e.target.value.replace(/[^a-z0-9_]/gi,"_") })} className={inputCls} /></FormField>
                {selField.type !== "heading" && (
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selField.required ?? false} onChange={(e) => updateField(selField.id, { required: e.target.checked })} /> Required</label>
                )}
                {!["heading","checkbox","file","date"].includes(selField.type) && (
                  <FormField label="Placeholder"><input value={selField.placeholder ?? ""} onChange={(e) => updateField(selField.id, { placeholder: e.target.value })} className={inputCls} /></FormField>
                )}
                <FormField label="Help text"><input value={selField.help ?? ""} onChange={(e) => updateField(selField.id, { help: e.target.value })} className={inputCls} /></FormField>
                {["select","radio","checkboxes"].includes(selField.type) && (
                  <FormField label="Options (one per line)">
                    <textarea value={(selField.options ?? []).join("\n")} onChange={(e) => updateField(selField.id, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} rows={4} className={inputCls} />
                  </FormField>
                )}
              </div>
            )}
          </div>
        </div>
      </DndContext>
    </AdminShell>
  );
}

function Canvas({ form, selected, onSelect, onRemove }: { form: any; selected: string|null; onSelect: (id: string) => void; onRemove: (id: string) => void }) {
  const { setNodeRef } = useDroppable({ id: "canvas" });
  if (!form) return <div className="rounded-xl border border-border bg-card p-6">Loading…</div>;
  return (
    <div ref={setNodeRef} className="min-h-[400px] rounded-xl border-2 border-dashed border-border bg-card p-4">
      {form.schema.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Click a field type on the left to add it.</p>
      ) : (
        <SortableContext items={form.schema.map((f: Field) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {form.schema.map((f: Field) => (
              <SortableField key={f.id} field={f} active={selected === f.id} onSelect={() => onSelect(f.id)} onRemove={() => onRemove(f.id)} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}

function SortableField({ field, active, onSelect, onRemove }: { field: Field; active: boolean; onSelect: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect}
      className={`flex items-start gap-2 rounded-lg border bg-background p-3 ${active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground" onClick={(e) => e.stopPropagation()}><GripVertical className="h-4 w-4" /></button>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{field.type}{field.required && " · required"}</div>
        <div className="text-sm font-medium">{field.label}</div>
        <FieldPreview field={field} />
      </div>
      <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function FieldPreview({ field }: { field: Field }) {
  const c = "mt-2 w-full rounded-md border border-input bg-muted/30 px-2 py-1 text-xs";
  switch (field.type) {
    case "paragraph": return <textarea disabled placeholder={field.placeholder} className={c} rows={2} />;
    case "select": return <select disabled className={c}><option>{field.placeholder ?? "Select…"}</option></select>;
    case "radio": case "checkboxes": return <div className="mt-2 space-y-1">{(field.options ?? []).map(o => <label key={o} className="flex items-center gap-1 text-xs"><input type={field.type === "radio" ? "radio" : "checkbox"} disabled /> {o}</label>)}</div>;
    case "checkbox": return <label className="mt-2 flex items-center gap-1 text-xs"><input type="checkbox" disabled /> {field.label}</label>;
    case "heading": return <div className="mt-1 text-base font-bold">{field.label}</div>;
    case "file": return <input type="file" disabled className={c} />;
    default: return <input type={field.type === "phone" ? "tel" : field.type} disabled placeholder={field.placeholder} className={c} />;
  }
}

// silence unused import
void useDraggable;
