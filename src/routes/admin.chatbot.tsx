import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Eye } from "lucide-react";

export const Route = createFileRoute("/admin/chatbot")({
  head: () => ({ meta: [{ title: "Chatbot Knowledge — Admin" }] }),
  component: ChatbotKnowledgePage,
});

type Row = {
  id: string;
  section: string;
  content: string;
  display_order: number;
  enabled: boolean;
};

function ChatbotKnowledgePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("chatbot_knowledge" as any)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function patch(id: string, changes: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...changes } : r)));
  }

  async function saveRow(row: Row) {
    const { error } = await supabase
      .from("chatbot_knowledge" as any)
      .update({
        section: row.section,
        content: row.content,
        display_order: row.display_order,
        enabled: row.enabled,
      })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }

  async function addRow() {
    const nextOrder = (rows[rows.length - 1]?.display_order ?? 0) + 10;
    const { data, error } = await supabase
      .from("chatbot_knowledge" as any)
      .insert({ section: "New section", content: "", display_order: nextOrder, enabled: true })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setRows((rs) => [...rs, data as any]);
  }

  async function deleteRow(id: string) {
    if (!confirm("Delete this section?")) return;
    const { error } = await supabase.from("chatbot_knowledge" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    const swap = rows[idx + dir];
    if (!swap) return;
    const a = rows[idx];
    const aOrder = a.display_order;
    const bOrder = swap.display_order;
    await supabase.from("chatbot_knowledge" as any).update({ display_order: bOrder }).eq("id", a.id);
    await supabase.from("chatbot_knowledge" as any).update({ display_order: aOrder }).eq("id", swap.id);
    load();
  }

  const compiled = rows.filter((r) => r.enabled).map((r) => `# ${r.section}\n${r.content}`).join("\n\n");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chatbot Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">
            Edit the sections the FAGE Assistant uses as its system prompt. Enabled rows are concatenated in display order.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview((v) => !v)} className="btn-outline px-3 py-2 rounded flex items-center gap-2">
            <Eye className="w-4 h-4" /> {preview ? "Hide" : "Preview"} compiled prompt
          </button>
          <button onClick={addRow} className="btn-primary px-3 py-2 rounded flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add section
          </button>
        </div>
      </div>

      {preview && (
        <pre className="bg-muted p-4 rounded border text-xs whitespace-pre-wrap max-h-96 overflow-auto">
          {compiled || "(empty — no enabled sections)"}
        </pre>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r, i) => (
            <div key={r.id} className="border rounded-lg p-4 bg-card">
              <div className="flex items-center gap-3 mb-3">
                <input
                  className="flex-1 border rounded px-3 py-2 font-medium"
                  value={r.section}
                  onChange={(e) => patch(r.id, { section: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => patch(r.id, { enabled: e.target.checked })}
                  />
                  Enabled
                </label>
                <input
                  type="number"
                  className="w-20 border rounded px-2 py-2 text-sm"
                  value={r.display_order}
                  onChange={(e) => patch(r.id, { display_order: Number(e.target.value) })}
                />
                <button disabled={i === 0} onClick={() => move(r.id, -1)} className="p-2 disabled:opacity-30">
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  disabled={i === rows.length - 1}
                  onClick={() => move(r.id, 1)}
                  className="p-2 disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => saveRow(r)} className="btn-primary px-3 py-2 rounded flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save
                </button>
                <button onClick={() => deleteRow(r.id)} className="text-destructive p-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                className="w-full border rounded px-3 py-2 font-mono text-sm min-h-[140px]"
                value={r.content}
                onChange={(e) => patch(r.id, { content: e.target.value })}
              />
            </div>
          ))}
          {rows.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No sections yet — click <b>Add section</b> to create one. If empty, the assistant falls back to the built-in prompt.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
