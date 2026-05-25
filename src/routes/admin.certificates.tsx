import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Save, Eye, ListChecks, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { Slider } from "@/components/ui/slider";
import {
  defaultLayout,
  mergeLayout,
  normalizeSigners,
  defaultSigner,
  FIELD_KEYS,
  FIELD_LABELS,
  fieldValue,
  type TemplateLayout,
  type FieldKey,
  type Signer,
} from "@/lib/certificate-render";
import QRCodeStyling from "qr-code-styling";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/certificates")({
  head: () => ({ meta: [{ title: "Certificate Designer — Admin" }] }),
  component: DesignerPage,
});

const FONT_OPTIONS = [
  "'Inter', sans-serif",
  "'Playfair Display', serif",
  "'Merriweather', serif",
  "'Georgia', serif",
  "'Montserrat', sans-serif",
  "'Roboto', sans-serif",
  "'Great Vibes', cursive",
  "'Dancing Script', cursive",
  "'Courier New', monospace",
];

const TIERS = ["associate", "standard", "corporate"] as const;

function DesignerPage() {
  const [tier, setTier] = useState<(typeof TIERS)[number]>("associate");
  const [template, setTemplate] = useState<any | null>(null);
  const [layout, setLayout] = useState<TemplateLayout>(defaultLayout());
  const [name, setName] = useState("");
  const [authorizedName, setAuthorizedName] = useState("FAGE President");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [signatureUrl, setSignatureUrl] = useState<string>("");
  const [signers, setSigners] = useState<Signer[]>([]);
  const [activeSignerId, setActiveSignerId] = useState<string | null>(null);
  const [active, setActive] = useState<FieldKey | "qr" | "signers" | null>("name");
  const [saving, setSaving] = useState(false);

  // Sample preview values
  const sampleCert = {
    full_name: "John Asante",
    member_id: "FAGE-ASSOC-25000001",
    tier,
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    verification_code: "PREVIEW-CODE",
  };

  async function loadTier(t: typeof tier) {
    const { data } = await supabase
      .from("certificate_templates")
      .select("*")
      .eq("tier", t)
      .maybeSingle();
    if (data) {
      setTemplate(data);
      setLayout(mergeLayout(data.field_positions));
      setName(data.name ?? "");
      setAuthorizedName(data.authorized_name ?? "FAGE President");
      setImageUrl(data.image_url ?? "");
      setSignatureUrl(data.signature_url ?? "");
      const s = normalizeSigners(data);
      setSigners(s);
      setActiveSignerId(s[0]?.id ?? null);
    } else {
      setTemplate(null);
      setLayout(defaultLayout());
      setName(`${t.charAt(0).toUpperCase()}${t.slice(1)} Certificate`);
      setAuthorizedName("FAGE President");
      setImageUrl("");
      setSignatureUrl("");
      setSigners([]);
      setActiveSignerId(null);
    }
  }
  useEffect(() => {
    void loadTier(tier);
  }, [tier]);

  async function uploadAsset(file: File, folder: string) {
    const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage
      .from("certificate-assets")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("certificate-assets").getPublicUrl(path).data.publicUrl;
  }

  async function onUploadBg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadAsset(f, "templates");
      setImageUrl(url);
      // detect natural size and update canvas
      const img = new Image();
      img.onload = () =>
        setLayout((l) => ({ ...l, canvas: { w: img.naturalWidth, h: img.naturalHeight } }));
      img.src = url;
      toast.success("Background uploaded");
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  async function onUploadSignerFile(signerId: string, file: File) {
    try {
      const url = await uploadAsset(file, "signatures");
      setSigners((arr) =>
        arr.map((s) => (s.id === signerId ? { ...s, signature_url: url } : s)),
      );
      toast.success("Signature uploaded");
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  function updateSigner(signerId: string, patch: Partial<Signer>) {
    setSigners((arr) => arr.map((s) => (s.id === signerId ? { ...s, ...patch } : s)));
  }
  function addSigner() {
    const s = defaultSigner({ label: `Signer ${signers.length + 1}`, name: "" });
    setSigners((arr) => [...arr, s]);
    setActive("signers");
    setActiveSignerId(s.id);
  }
  function removeSigner(signerId: string) {
    setSigners((arr) => arr.filter((s) => s.id !== signerId));
    if (activeSignerId === signerId) setActiveSignerId(null);
  }
  async function onUploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const url = await uploadAsset(f, "qr-logos");
      setLayout((l) => ({ ...l, qr: { ...l.qr, logoUrl: url } }));
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function save() {
    if (!imageUrl) return toast.error("Upload a background image first");
    setSaving(true);
    try {
      const payload: any = {
        name,
        tier,
        image_url: imageUrl,
        signature_url: signatureUrl || null,
        authorized_name: authorizedName,
        field_positions: layout,
        signers,
        is_active: true,
      };
      const { error } = template?.id
        ? await supabase.from("certificate_templates").update(payload).eq("id", template.id)
        : await supabase.from("certificate_templates").insert(payload);
      if (error) throw error;
      toast.success("Template saved");
      await loadTier(tier);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTo(targetTier: (typeof TIERS)[number]) {
    if (targetTier === tier) return toast.error("Pick a different tier to copy into.");
    if (!imageUrl) return toast.error("Save or upload a background first.");
    if (
      !confirm(
        `Copy this design into the ${targetTier} template? Any existing ${targetTier} template will be overwritten.`,
      )
    )
      return;
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("certificate_templates")
        .select("id")
        .eq("tier", targetTier)
        .maybeSingle();
      const payload = {
        name: `${targetTier.charAt(0).toUpperCase()}${targetTier.slice(1)} Certificate`,
        tier: targetTier,
        image_url: imageUrl,
        signature_url: signatureUrl || null,
        authorized_name: authorizedName,
        field_positions: layout,
        is_active: true,
      };
      const { error } = existing
        ? await supabase.from("certificate_templates").update(payload).eq("id", existing.id)
        : await supabase.from("certificate_templates").insert(payload);
      if (error) throw error;
      toast.success(`Copied to ${targetTier}. Switching…`);
      setTier(targetTier);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updField(k: FieldKey, patch: Partial<TemplateLayout["fields"][string]>) {
    setLayout((l) => ({ ...l, fields: { ...l.fields, [k]: { ...l.fields[k], ...patch } } }));
  }

  return (
    <AdminShell
      title="Certificate Designer"
      description="Visually configure the certificate for each membership tier."
      action={
        <div className="flex gap-2">
          <Link
            to="/admin/cert-batch"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            <Layers className="h-4 w-4" /> Batch issue
          </Link>
          <Link
            to="/admin/cert-issued"
            className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-accent"
          >
            <ListChecks className="h-4 w-4" /> Issued
          </Link>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium">Tier:</label>
        <div className="flex rounded-full bg-muted p-1">
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize ${tier === t ? "bg-primary text-primary-foreground" : ""}`}
            >
              {t}
            </button>
          ))}
        </div>
        <select
          onChange={(e) => {
            const v = e.target.value as (typeof TIERS)[number] | "";
            if (v) {
              void duplicateTo(v);
              e.currentTarget.selectedIndex = 0;
            }
          }}
          disabled={saving || !imageUrl}
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm disabled:opacity-50"
          title={imageUrl ? "Copy this design to another tier" : "Upload a background first"}
        >
          <option value="">Copy design to…</option>
          {TIERS.filter((t) => t !== tier).map((t) => (
            <option key={t} value={t}>
              Copy to {t}
            </option>
          ))}
        </select>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="ml-auto rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save template"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        {/* Preview */}
        <div className="rounded-2xl border border-border bg-card p-3">
          {!imageUrl ? (
            <div className="flex aspect-[1.414/1] items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
              <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-8 w-8" />
                <span>Upload certificate background</span>
                <span className="text-xs">Landscape image, min 1414×1000</span>
                <input type="file" accept="image/*" onChange={onUploadBg} className="hidden" />
              </label>
            </div>
          ) : (
            <PreviewCanvas
              layout={layout}
              imageUrl={imageUrl}
              signers={signers}
              activeSignerId={activeSignerId}
              setActiveSignerId={setActiveSignerId}
              sampleCert={sampleCert}
              active={active}
              onSelect={setActive}
              onMoveField={(k: FieldKey, x: number, y: number) => updField(k, { x, y })}
              onMoveQr={(x: number, y: number) =>
                setLayout((l) => ({ ...l, qr: { ...l.qr, x, y } }))
              }
              onMoveSigner={(id: string, x: number, y: number) => updateSigner(id, { x, y })}
            />
          )}
          {imageUrl && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs text-primary">
              <Upload className="h-3 w-3" /> Replace background
              <input type="file" accept="image/*" onChange={onUploadBg} className="hidden" />
            </label>
          )}
        </div>

        {/* Right control panel */}
        <div className="space-y-4">
          {/* Field selector */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-bold">Fields</h3>
            <div className="grid grid-cols-2 gap-1">
              {FIELD_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setActive(k)}
                  className={`rounded-md px-2 py-1.5 text-xs ${active === k ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
                >
                  {FIELD_LABELS[k]}
                </button>
              ))}
              <button
                onClick={() => setActive("qr")}
                className={`rounded-md px-2 py-1.5 text-xs ${active === "qr" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
              >
                QR Code
              </button>
              <button
                onClick={() => setActive("signers")}
                className={`rounded-md px-2 py-1.5 text-xs ${active === "signers" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
              >
                Signers ({signers.length})
              </button>
            </div>
          </div>

          {/* Active controls */}
          {active && active !== "qr" && active !== "signers" && (
            <FieldControls
              fieldKey={active}
              field={layout.fields[active]}
              canvas={layout.canvas}
              dateFormat={layout.dateFormat}
              onChange={(patch) => updField(active, patch)}
              onDateFormatChange={(v) => setLayout((l) => ({ ...l, dateFormat: v }))}
            />
          )}
          {active === "qr" && (
            <QrControls layout={layout} setLayout={setLayout} onUploadLogo={onUploadLogo} />
          )}
          {active === "signers" && (
            <SignersControls
              signers={signers}
              activeSignerId={activeSignerId}
              setActiveSignerId={setActiveSignerId}
              canvas={layout.canvas}
              onAdd={addSigner}
              onRemove={removeSigner}
              onUpdate={updateSigner}
              onUploadFile={onUploadSignerFile}
            />
          )}

          {/* Verification display */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> QR scan reveals
            </h3>
            <p className="mb-2 text-xs text-muted-foreground">
              Fields shown when the QR is scanned.
            </p>
            <div className="space-y-1">
              {(["name", "member_id", "tier", "issued", "expires"] as const).map((k) => {
                const list = layout.verification_display ?? [];
                const on = list.includes(k);
                return (
                  <label key={k} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const next = e.target.checked ? [...list, k] : list.filter((x) => x !== k);
                        setLayout((l) => ({ ...l, verification_display: next }));
                      }}
                    />
                    {FIELD_LABELS[k as FieldKey]}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function FieldControls({
  fieldKey,
  field,
  canvas,
  dateFormat,
  onChange,
  onDateFormatChange,
}: {
  fieldKey: FieldKey;
  field: any;
  canvas: { w: number; h: number };
  dateFormat?: string;
  onChange: (p: any) => void;
  onDateFormatChange: (v: string) => void;
}) {
  const isDate = fieldKey === "issued" || fieldKey === "expires";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-bold">Position & style</h3>
      <SliderRow
        label={`X: ${field.x}`}
        value={field.x}
        max={canvas.w}
        onChange={(v) => onChange({ x: v })}
      />
      <SliderRow
        label={`Y: ${field.y}`}
        value={field.y}
        max={canvas.h}
        onChange={(v) => onChange({ y: v })}
      />
      <SliderRow
        label={`Size: ${field.fontSize}px`}
        value={field.fontSize}
        min={8}
        max={140}
        onChange={(v) => onChange({ fontSize: v })}
      />
      <div>
        <label className="mb-1 block text-xs font-medium">Font family</label>
        <select
          value={field.font}
          onChange={(e) => onChange({ font: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f.replace(/'/g, "")}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Weight</label>
          <select
            value={field.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {["400", "500", "600", "700", "800", "900"].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Align</label>
          <select
            value={field.align}
            onChange={(e) => onChange({ align: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium">Color</label>
        <input
          type="color"
          value={field.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-8 w-16 rounded border"
        />
        <label className="ml-auto flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={field.visible}
            onChange={(e) => onChange({ visible: e.target.checked })}
          />{" "}
          Visible
        </label>
      </div>
      {isDate && (
        <div>
          <label className="mb-1 block text-xs font-medium">Date format</label>
          <select
            value={dateFormat ?? "D MMMM YYYY"}
            onChange={(e) => onDateFormatChange(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {DATE_FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Applies to both issue and expiry dates.
          </p>
        </div>
      )}
    </div>
  );
}

function QrControls({ layout, setLayout, onUploadLogo }: any) {
  const upd = (patch: any) =>
    setLayout((l: TemplateLayout) => ({ ...l, qr: { ...l.qr, ...patch } }));
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-bold">QR Code</h3>
      <SliderRow
        label={`X: ${layout.qr.x}`}
        value={layout.qr.x}
        max={layout.canvas.w}
        onChange={(v) => upd({ x: v })}
      />
      <SliderRow
        label={`Y: ${layout.qr.y}`}
        value={layout.qr.y}
        max={layout.canvas.h}
        onChange={(v) => upd({ y: v })}
      />
      <SliderRow
        label={`Size: ${layout.qr.size}`}
        value={layout.qr.size}
        min={60}
        max={400}
        onChange={(v) => upd({ size: v })}
      />
      <div>
        <label className="mb-1 block text-xs font-medium">Dot style</label>
        <select
          value={layout.qr.dotType}
          onChange={(e) => upd({ dotType: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
        >
          {["square", "rounded", "dots", "classy", "extra-rounded"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <label className="text-xs">FG</label>
          <input
            type="color"
            value={layout.qr.fgColor}
            onChange={(e) => upd({ fgColor: e.target.value })}
            className="h-7 w-12 rounded border"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs">BG</label>
          <input
            type="color"
            value={layout.qr.bgColor}
            onChange={(e) => upd({ bgColor: e.target.value })}
            className="h-7 w-12 rounded border"
          />
        </div>
      </div>
      <SliderRow
        label={`Border: ${layout.qr.border}px`}
        value={layout.qr.border}
        min={0}
        max={20}
        onChange={(v) => upd({ border: v })}
      />
      {layout.qr.border > 0 && (
        <div className="flex items-center gap-1">
          <label className="text-xs">Border color</label>
          <input
            type="color"
            value={layout.qr.borderColor}
            onChange={(e) => upd({ borderColor: e.target.value })}
            className="h-7 w-12 rounded border"
          />
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium">Center logo</label>
        <input type="file" accept="image/*" onChange={onUploadLogo} className="text-xs" />
        {layout.qr.logoUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img src={layout.qr.logoUrl} className="h-8 w-8 rounded border object-contain" />
            <button onClick={() => upd({ logoUrl: null })} className="text-xs text-destructive">
              Remove
            </button>
          </div>
        )}
      </div>
      {layout.qr.logoUrl && (
        <SliderRow
          label={`Logo size: ${(layout.qr.logoSize * 100).toFixed(0)}%`}
          value={Math.round(layout.qr.logoSize * 100)}
          min={10}
          max={50}
          onChange={(v) => upd({ logoSize: v / 100 })}
        />
      )}
    </div>
  );
}

function SignersControls({
  signers,
  activeSignerId,
  setActiveSignerId,
  canvas,
  onAdd,
  onRemove,
  onUpdate,
  onUploadFile,
}: {
  signers: Signer[];
  activeSignerId: string | null;
  setActiveSignerId: (id: string | null) => void;
  canvas: { w: number; h: number };
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Signer>) => void;
  onUploadFile: (id: string, file: File) => void;
}) {
  const active = signers.find((s) => s.id === activeSignerId) ?? null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Signers</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Label is admin-only (which file is whose). Name is what appears on the certificate.
      </p>
      <div className="space-y-1.5">
        {signers.length === 0 && (
          <div className="text-xs text-muted-foreground">No signers yet. Click Add.</div>
        )}
        {signers.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSignerId(s.id)}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs ${activeSignerId === s.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}
          >
            <span className="truncate">
              {s.label || "Unlabeled"} — <span className="opacity-80">{s.name || "(no name)"}</span>
            </span>
            <Trash2
              className="h-3 w-3 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Remove signer "${s.label}"?`)) onRemove(s.id);
              }}
            />
          </button>
        ))}
      </div>

      {active && (
        <div className="space-y-3 border-t border-border pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Label (admin only)</label>
            <input
              value={active.label}
              onChange={(e) => onUpdate(active.id, { label: e.target.value })}
              placeholder="e.g. CEO, President"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Name on certificate</label>
            <input
              value={active.name}
              onChange={(e) => onUpdate(active.id, { name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Signature image</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadFile(active.id, f);
              }}
              className="text-xs"
            />
            {active.signature_url && (
              <img
                src={active.signature_url}
                className="mt-2 h-14 rounded border bg-white object-contain p-1"
              />
            )}
          </div>
          <SliderRow
            label={`X: ${active.x}`}
            value={active.x}
            max={canvas.w}
            onChange={(v) => onUpdate(active.id, { x: v })}
          />
          <SliderRow
            label={`Y: ${active.y}`}
            value={active.y}
            max={canvas.h}
            onChange={(v) => onUpdate(active.id, { y: v })}
          />
          <SliderRow
            label={`Width: ${active.w}`}
            value={active.w}
            min={50}
            max={500}
            onChange={(v) => onUpdate(active.id, { w: v })}
          />
          <SliderRow
            label={`Height: ${active.h}`}
            value={active.h}
            min={20}
            max={200}
            onChange={(v) => onUpdate(active.id, { h: v })}
          />
          <SliderRow
            label={`Name size: ${active.nameFontSize}px`}
            value={active.nameFontSize}
            min={10}
            max={60}
            onChange={(v) => onUpdate(active.id, { nameFontSize: v })}
          />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={active.visible}
              onChange={(e) => onUpdate(active.id, { visible: e.target.checked })}
            />
            Visible on certificate
          </label>
        </div>
      )}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-right"
        />
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function PreviewCanvas({
  layout,
  imageUrl,
  signers,
  activeSignerId,
  setActiveSignerId,
  sampleCert,
  active,
  onSelect,
  onMoveField,
  onMoveQr,
  onMoveSigner,
}: any) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [drag, setDrag] = useState<null | {
    type: "field" | "qr" | "signer";
    key?: string;
    offX: number;
    offY: number;
  }>(null);

  useEffect(() => {
    const update = () => {
      if (!wrapRef.current) return;
      const w = wrapRef.current.clientWidth;
      setScale(w / layout.canvas.w);
    };
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [layout.canvas.w]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const qrCode = new QRCodeStyling({
        width: layout.qr.size,
        height: layout.qr.size,
        type: "canvas",
        data: `${window.location.origin}/verify/PREVIEW`,
        image: layout.qr.logoUrl ?? undefined,
        dotsOptions: { color: layout.qr.fgColor, type: layout.qr.dotType },
        backgroundOptions: { color: layout.qr.bgColor },
        cornersSquareOptions: { color: layout.qr.fgColor },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: layout.qr.logoSize,
          margin: 4,
          crossOrigin: "anonymous",
        },
      });
      const blob = await qrCode.getRawData("png");
      if (blob && !cancelled) {
        const fr = new FileReader();
        fr.onload = () => !cancelled && setQrUrl(String(fr.result));
        fr.readAsDataURL(blob as Blob);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [layout.qr]);

  function startDrag(e: React.PointerEvent, type: "field" | "qr" | "signer", key?: string) {
    e.stopPropagation();
    let target: { x: number; y: number };
    if (type === "field") target = layout.fields[key!];
    else if (type === "qr") target = layout.qr;
    else target = signers.find((s: Signer) => s.id === key) ?? { x: 0, y: 0 };
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale;
    const py = (e.clientY - rect.top) / scale;
    setDrag({ type, key, offX: px - target.x, offY: py - target.y });
    if (type === "field") onSelect(key);
    else if (type === "qr") onSelect("qr");
    else {
      onSelect("signers");
      setActiveSignerId(key!);
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / scale - drag.offX;
    const py = (e.clientY - rect.top) / scale - drag.offY;
    const x = Math.round(px);
    const y = Math.round(py);
    if (drag.type === "field") onMoveField(drag.key as FieldKey, x, y);
    else if (drag.type === "qr") onMoveQr(x, y);
    else onMoveSigner(drag.key!, x, y);
  }
  function endDrag() {
    setDrag(null);
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none overflow-hidden rounded-xl"
      style={{
        aspectRatio: `${layout.canvas.w}/${layout.canvas.h}`,
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "cover",
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    >
      {FIELD_KEYS.map((k) => {
        const f = layout.fields[k];
        if (!f.visible) return null;
        if (k === "authorized_name" && signers.length > 0) return null;
        const text = fieldValue(k, sampleCert, { authorized_name: "" }, layout.dateFormat);
        const transform =
          f.align === "center"
            ? "translate(-50%, -100%)"
            : f.align === "right"
              ? "translate(-100%, -100%)"
              : "translate(0, -100%)";
        return (
          <div
            key={k}
            onPointerDown={(e) => startDrag(e, "field", k)}
            className={`absolute cursor-move whitespace-nowrap ${active === k ? "outline outline-2 outline-primary outline-offset-2" : ""}`}
            style={{
              left: `${(f.x / layout.canvas.w) * 100}%`,
              top: `${(f.y / layout.canvas.h) * 100}%`,
              fontSize: `${f.fontSize * scale}px`,
              fontFamily: f.font,
              fontWeight: f.weight,
              color: f.color,
              transform,
              padding: 2,
            }}
          >
            {text}
          </div>
        );
      })}

      {signers.map((s: Signer) => {
        if (!s.visible) return null;
        const isActive = active === "signers" && activeSignerId === s.id;
        return (
          <div
            key={s.id}
            onPointerDown={(e) => startDrag(e, "signer", s.id)}
            className={`absolute cursor-move ${isActive ? "outline outline-2 outline-primary" : ""}`}
            style={{
              left: `${(s.x / layout.canvas.w) * 100}%`,
              top: `${(s.y / layout.canvas.h) * 100}%`,
              width: `${(s.w / layout.canvas.w) * 100}%`,
              height: `${(s.h / layout.canvas.h) * 100}%`,
            }}
          >
            {s.signature_url ? (
              <img
                src={s.signature_url}
                draggable={false}
                className="h-full w-full object-contain pointer-events-none"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-primary/60 bg-primary/5 text-[10px] text-primary">
                {s.label}
              </div>
            )}
            {s.name && (
              <div
                className="absolute left-1/2 whitespace-nowrap"
                style={{
                  top: `calc(100% + ${s.nameOffsetY * scale - s.nameFontSize * scale}px)`,
                  transform: "translateX(-50%)",
                  fontSize: `${s.nameFontSize * scale}px`,
                  fontFamily: s.nameFontFamily,
                  fontWeight: s.nameFontWeight,
                  color: s.nameColor,
                }}
              >
                {s.name}
              </div>
            )}
          </div>
        );
      })}

      {qrUrl && (
        <div
          onPointerDown={(e) => startDrag(e, "qr")}
          className={`absolute cursor-move ${active === "qr" ? "outline outline-2 outline-primary" : ""}`}
          style={{
            left: `${(layout.qr.x / layout.canvas.w) * 100}%`,
            top: `${(layout.qr.y / layout.canvas.h) * 100}%`,
            width: `${(layout.qr.size / layout.canvas.w) * 100}%`,
            height: `${(layout.qr.size / layout.canvas.w) * 100}%`,
            padding: layout.qr.border,
            background: layout.qr.border > 0 ? layout.qr.borderColor : "transparent",
          }}
        >
          <img src={qrUrl} draggable={false} className="h-full w-full" />
        </div>
      )}
    </div>
  );
}
