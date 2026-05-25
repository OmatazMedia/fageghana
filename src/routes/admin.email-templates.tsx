import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Save, Send, Trash2 } from "lucide-react";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  listEmailTemplates,
  saveEmailTemplate,
  sendTemplateTest,
} from "@/lib/email/admin.functions";
import { renderEmail, type Block } from "@/lib/email/render";

export const Route = createFileRoute("/admin/email-templates")({
  head: () => ({ meta: [{ title: "Email Templates — FAGE Admin" }] }),
  component: EmailTemplatesPage,
});

const variables = [
  "{{name}}",
  "{{member_id}}",
  "{{tier}}",
  "{{amount}}",
  "{{temp_password}}",
  "{{login_url}}",
  "{{receipt_url}}",
];

function newBlock(type: Block["type"]): Block {
  const id = crypto.randomUUID();
  if (type === "heading") return { id, type, text: "Email heading", align: "left" };
  if (type === "text") return { id, type, text: "Write your message here.", align: "left" };
  if (type === "image") return { id, type, url: "", alt: "", align: "center" };
  if (type === "button")
    return { id, type, text: "Open link", url: "{{login_url}}", align: "center" };
  if (type === "spacer") return { id, type, height: 20 };
  return { id, type: "divider" };
}

function EmailTemplatesPage() {
  const loadTemplates = useServerFn(listEmailTemplates);
  const saveTemplate = useServerFn(saveEmailTemplate);
  const sendTest = useServerFn(sendTemplateTest);
  const [templates, setTemplates] = useState<any[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [draft, setDraft] = useState<any | null>(null);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await loadTemplates();
    setTemplates(res.templates ?? []);
    if (!draft && res.templates?.[0]) {
      setCurrentId(res.templates[0].id);
      setDraft(res.templates[0]);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  const blocks = (draft?.blocks ?? []) as Block[];
  const preview = useMemo(
    () =>
      renderEmail(blocks, {
        name: "Ama Mensah",
        member_id: "FAGE-ASSOC-26-000001",
        tier: "associate",
        amount: "GHS 500",
        temp_password: "Ama@23",
        login_url: "https://fageghana.lovable.app/login",
        receipt_url: "https://fageghana.lovable.app/receipt/demo",
      }).html,
    [blocks],
  );

  function selectTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    setCurrentId(id);
    setDraft(tpl ? { ...tpl } : null);
  }

  function updateBlock(id: string, patch: Record<string, any>) {
    setDraft((d: any) => ({
      ...d,
      blocks: ((d?.blocks ?? []) as Block[]).map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }

  function removeBlock(id: string) {
    setDraft((d: any) => ({
      ...d,
      blocks: ((d?.blocks ?? []) as Block[]).filter((b) => b.id !== id),
    }));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    setDraft((d: any) => ({ ...d, blocks: arrayMove(blocks, oldIndex, newIndex) }));
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      await saveTemplate({
        data: {
          id: draft.id,
          key: draft.key,
          name: draft.name,
          subject: draft.subject,
          description: draft.description ?? "",
          blocks,
        },
      });
      toast.success("Template saved");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save template");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!draft || !testTo) return toast.error("Choose a template and enter a test email");
    setBusy(true);
    try {
      const res = await sendTest({
        data: {
          key: draft.key,
          to: testTo,
          vars: {
            name: "Ama Mensah",
            member_id: "FAGE-ASSOC-26-000001",
            tier: "associate",
            temp_password: "Ama@23",
            login_url: location.origin + "/login",
          },
        },
      });
      if (res.ok) toast.success(`Test email sent via ${res.provider}`);
      else toast.error(res.error ?? "Test email failed");
    } catch (e: any) {
      toast.error(e?.message ?? "Test email failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Email Templates"
      description="Edit transactional emails with themed blocks and merge tags."
    >
      <div className="grid gap-6 xl:grid-cols-[30%_70%]">
        <div className="space-y-6">
          <aside className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold">Templates</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${currentId === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </aside>

          {draft && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <FormField label="Template name">
                  <input
                    className={inputCls}
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </FormField>
                <FormField label="Subject">
                  <input
                    className={inputCls}
                    value={draft.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  ["heading", "text", "image", "button", "divider", "spacer"] as Block["type"][]
                ).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDraft({ ...draft, blocks: [...blocks, newBlock(type)] })}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs capitalize hover:bg-accent"
                  >
                    <Plus className="h-3 w-3" /> {type}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <button
                    key={v}
                    onClick={() => navigator.clipboard?.writeText(v)}
                    className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext
                  items={blocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="mt-5 space-y-3">
                    {blocks.map((b) => (
                      <BlockEditor
                        key={b.id}
                        block={b}
                        onChange={(patch) => updateBlock(b.id, patch)}
                        onRemove={() => removeBlock(b.id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <FormField label="Send test to">
                  <input
                    type="email"
                    className={inputCls}
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                  />
                </FormField>
                <button
                  disabled={busy}
                  onClick={send}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-accent disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> Send test
                </button>
                <button
                  disabled={busy}
                  onClick={save}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> Save
                </button>
              </div>
            </section>
          )}
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4 xl:sticky xl:top-4 xl:self-start">
          <h2 className="mb-3 text-sm font-bold">Live preview</h2>
          <iframe
            title="Email preview"
            className="h-[680px] w-full rounded-xl border border-border bg-background"
            srcDoc={preview}
          />
        </aside>
      </div>
    </AdminShell>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: Block;
  onChange: (patch: any) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="rounded-xl border border-border bg-background p-3"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="mr-auto text-xs font-bold uppercase text-muted-foreground">
          {block.type}
        </span>
        <button onClick={onRemove} className="rounded p-1 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {(block.type === "heading" || block.type === "text") && (
        <textarea
          className={`${inputCls} min-h-20`}
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
      {block.type === "image" && (
        <div className="grid gap-2">
          <input
            className={inputCls}
            placeholder="Image URL"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Alt text"
            value={block.alt ?? ""}
            onChange={(e) => onChange({ alt: e.target.value })}
          />
        </div>
      )}
      {block.type === "button" && (
        <div className="grid gap-2">
          <input
            className={inputCls}
            placeholder="Button text"
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Button URL"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </div>
      )}
      {block.type === "spacer" && (
        <input
          type="number"
          className={inputCls}
          value={block.height ?? 20}
          onChange={(e) => onChange({ height: Number(e.target.value) })}
        />
      )}
      {(block.type === "heading" ||
        block.type === "text" ||
        block.type === "image" ||
        block.type === "button") && (
        <select
          className={`${inputCls} mt-2`}
          value={(block as any).align ?? "left"}
          onChange={(e) => onChange({ align: e.target.value })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      )}
    </div>
  );
}
