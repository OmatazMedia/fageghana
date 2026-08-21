import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { uploadImage } from "@/lib/uploadImage";

type Slide = {
  id: string;
  image_url: string;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
  cta_href: string | null;
  display_order: number;
  is_active: boolean;
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function HeroSlidesManager() {
  const [rows, setRows] = useState<Slide[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("site_hero_slides" as any)
      .select("*")
      .order("display_order");
    setRows((data ?? []) as unknown as Slide[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, patch: Partial<Slide>) {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    const { error } = await supabase
      .from("site_hero_slides" as any)
      .update(patch as any)
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function addSlide() {
    setBusy(true);
    const order = (rows.at(-1)?.display_order ?? 0) + 1;
    const { error } = await supabase
      .from("site_hero_slides" as any)
      .insert({ image_url: "", title: "New slide", display_order: order } as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this slide?")) return;
    const { error } = await supabase.from("site_hero_slides" as any).delete().eq("id", id);
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
      const url = await uploadImage(file, "hero");
      await patch(id, { image_url: url });
      toast.success("Image updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Hero slides</h2>
          <p className="text-xs text-muted-foreground">
            Manage the homepage hero carousel. Drag-order with arrows. Toggle visibility.
          </p>
        </div>
        <button
          onClick={addSlide}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add slide
        </button>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No slides yet. Add your first one.
        </p>
      )}

      <div className="space-y-3">
        {rows.map((s, i) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-[160px,1fr,auto]">
              <div>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-input bg-background px-2 py-1.5 text-[11px] hover:bg-accent">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUpload(s.id, f);
                    }}
                  />
                  Change image
                </label>
              </div>
              <div className="space-y-2">
                <input
                  className={inputCls}
                  placeholder="Eyebrow (small caption)"
                  defaultValue={s.eyebrow ?? ""}
                  onBlur={(e) => patch(s.id, { eyebrow: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Title"
                  defaultValue={s.title ?? ""}
                  onBlur={(e) => patch(s.id, { title: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Subtitle (optional)"
                  defaultValue={s.subtitle ?? ""}
                  onBlur={(e) => patch(s.id, { subtitle: e.target.value })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className={inputCls}
                    placeholder="Button label (optional)"
                    defaultValue={s.cta_label ?? ""}
                    onBlur={(e) => patch(s.id, { cta_label: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    placeholder="Button link (e.g. /about/who-we-are)"
                    defaultValue={s.cta_href ?? ""}
                    onBlur={(e) => patch(s.id, { cta_href: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={s.is_active}
                      onChange={(e) => patch(s.id, { is_active: e.target.checked })}
                    />
                    Active (visible on site)
                  </label>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <button
                  onClick={() => move(s.id, -1)}
                  disabled={i === 0}
                  className="rounded-md border border-border p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => move(s.id, 1)}
                  disabled={i === rows.length - 1}
                  className="rounded-md border border-border p-1.5 hover:bg-accent disabled:opacity-40"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
