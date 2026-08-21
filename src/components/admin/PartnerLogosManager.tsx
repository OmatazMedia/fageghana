import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { uploadImage } from "@/lib/uploadImage";

type Partner = {
  id: string;
  name: string;
  logo_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function PartnerLogosManager() {
  const [rows, setRows] = useState<Partner[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("site_partner_logos" as any)
      .select("*")
      .order("display_order");
    setRows((data ?? []) as unknown as Partner[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, p: Partial<Partner>) {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, ...p } : s)));
    const { error } = await supabase
      .from("site_partner_logos" as any)
      .update(p as any)
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function add() {
    const order = (rows.at(-1)?.display_order ?? 0) + 1;
    const { error } = await supabase
      .from("site_partner_logos" as any)
      .insert({ name: "New partner", logo_url: "", display_order: order } as any);
    if (error) return toast.error(error.message);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this logo?")) return;
    const { error } = await supabase.from("site_partner_logos" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.id === id);
    const swap = rows[idx + dir];
    if (!swap) return;
    await Promise.all([
      patch(id, { display_order: swap.display_order }),
      patch(swap.id, { display_order: rows[idx].display_order }),
    ]);
    await load();
  }

  async function onUpload(id: string, file: File) {
    try {
      const url = await uploadImage(file, "partners");
      await patch(id, { logo_url: url });
      toast.success("Logo updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Partner logos</h2>
          <p className="text-xs text-muted-foreground">
            Logos shown in the "Our Partners" marquee on the homepage. Sized automatically to match
            the row height.
          </p>
        </div>
        <button
          onClick={add}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add logo
        </button>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No partner logos yet.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <input
                  className={inputCls}
                  placeholder="Partner name"
                  defaultValue={p.name}
                  onBlur={(e) => patch(p.id, { name: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Website (optional)"
                  defaultValue={p.link_url ?? ""}
                  onBlur={(e) => patch(p.id, { link_url: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 py-1 hover:bg-accent">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void onUpload(p.id, f);
                      }}
                    />
                    Upload logo
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={p.is_active}
                      onChange={(e) => patch(p.id, { is_active: e.target.checked })}
                    />
                    Active
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => move(p.id, -1)}
                      disabled={i === 0}
                      className="rounded-md border border-border p-1 hover:bg-accent disabled:opacity-40"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => move(p.id, 1)}
                      disabled={i === rows.length - 1}
                      className="rounded-md border border-border p-1 hover:bg-accent disabled:opacity-40"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
