import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { uploadImage } from "@/lib/uploadImage";
import { DynamicFieldRenderer, type CustomFieldDef } from "@/components/admin/DynamicFieldRenderer";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

type Entry = {
  id?: string;
  entry_type: "association" | "corporate";
  slug: string;
  company_name: string;
  short_description: string;
  long_description: string;
  mission: string;
  vision: string;
  services: string[];
  products: string[];
  executives: { role: string; name: string }[];
  director_name: string;
  contact_name: string;
  phone: string;
  email: string;
  website: string;
  physical_address: string;
  postal_address: string;
  country: string;
  region: string;
  logo_url: string;
  cover_image_url: string;
  category: string;
  custom_fields: Record<string, any>;
  status?: string;
  review_notes?: string | null;
};

const blank: Entry = {
  entry_type: "corporate",
  slug: "",
  company_name: "",
  short_description: "",
  long_description: "",
  mission: "",
  vision: "",
  services: [],
  products: [],
  executives: [],
  director_name: "",
  contact_name: "",
  phone: "",
  email: "",
  website: "",
  physical_address: "",
  postal_address: "",
  country: "Ghana",
  region: "",
  logo_url: "",
  cover_image_url: "",
  category: "",
  custom_fields: {},
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  pending: { label: "Pending Review", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved & Live", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", cls: "bg-destructive/15 text-destructive" },
  suspended: { label: "Suspended", cls: "bg-orange-100 text-orange-800" },
};

export function MyDirectoryListingTab({
  userId,
  subscriptionActive,
}: {
  userId: string;
  subscriptionActive: boolean;
}) {
  const [entry, setEntry] = useState<Entry>(blank);
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "cover" | null>(null);

  useEffect(() => {
    void (async () => {
      const [e, d] = await Promise.all([
        supabase.from("directory_entries").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("directory_custom_field_defs")
          .select("*")
          .eq("active", true)
          .order("display_order"),
      ]);
      if (e.data) {
        setEntry({
          ...blank,
          ...e.data,
          services: e.data.services ?? [],
          products: e.data.products ?? [],
          executives: (e.data.executives ?? []) as any,
          custom_fields: e.data.custom_fields ?? {},
        } as Entry);
      }
      setDefs((d.data ?? []) as CustomFieldDef[]);
      setLoading(false);
    })();
  }, [userId]);

  function set<K extends keyof Entry>(k: K, v: Entry[K]) {
    setEntry((p) => ({ ...p, [k]: v }));
  }

  function setCustom(key: string, value: any) {
    setEntry((p) => ({ ...p, custom_fields: { ...p.custom_fields, [key]: value } }));
  }

  async function handleUpload(file: File, kind: "logo" | "cover") {
    setUploading(kind);
    try {
      const url = await uploadImage(file, `directory/${kind === "logo" ? "logos" : "covers"}`);
      set(kind === "logo" ? "logo_url" : "cover_image_url", url);
      toast.success(`${kind === "logo" ? "Logo" : "Cover"} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  async function save(submit: boolean) {
    if (!entry.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_my_directory_entry", {
      _payload: {
        entry_type: entry.entry_type,
        slug: entry.slug,
        company_name: entry.company_name,
        short_description: entry.short_description || null,
        long_description: entry.long_description || null,
        mission: entry.mission || null,
        vision: entry.vision || null,
        services: entry.services,
        products: entry.products,
        executives: entry.executives,
        director_name: entry.director_name || null,
        contact_name: entry.contact_name || null,
        phone: entry.phone || null,
        email: entry.email || null,
        website: entry.website || null,
        physical_address: entry.physical_address || null,
        postal_address: entry.postal_address || null,
        country: entry.country || "Ghana",
        region: entry.region || null,
        logo_url: entry.logo_url || null,
        cover_image_url: entry.cover_image_url || null,
        category: entry.category || null,
        custom_fields: entry.custom_fields ?? {},
      },
      _submit: submit,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(submit ? "Submitted for review" : "Draft saved");
    // refresh
    const { data: row } = await supabase
      .from("directory_entries")
      .select("*")
      .eq("id", data as any)
      .maybeSingle();
    if (row) {
      setEntry({
        ...blank,
        ...row,
        services: row.services ?? [],
        products: row.products ?? [],
        executives: (row.executives ?? []) as any,
        custom_fields: row.custom_fields ?? {},
      } as Entry);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your listing…
      </div>
    );
  }

  const status = entry.status ?? "draft";
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const locked = !subscriptionActive;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Business Directory Listing</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit your business details to be published in the public FAGE directory.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sc.cls}`}>
              {sc.label}
            </span>
            {status === "approved" && entry.slug && (
              <a
                href={`/directory/${entry.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
              >
                View live <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {locked && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              An active subscription is required to publish or update your listing. Your existing
              listing is automatically hidden from the public directory until you renew.
            </div>
          </div>
        )}

        {status === "rejected" && entry.review_notes && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="font-semibold text-destructive mb-1">Admin feedback</div>
            <p className="text-foreground/80 whitespace-pre-line">{entry.review_notes}</p>
          </div>
        )}

        {status === "pending" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            Your listing is awaiting admin review. You can keep editing and it will stay queued.
          </div>
        )}

        {status === "approved" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
            Heads-up: submitting changes will return your listing to <strong>Pending</strong> for re-review before it goes live again.
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-2xl bg-card p-6 shadow-sm">
        <h3 className="text-base font-bold">Business details</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Listing type">
            <select
              value={entry.entry_type}
              onChange={(e) => set("entry_type", e.target.value as any)}
              className={inputCls}
              disabled={locked}
            >
              <option value="corporate">Corporate Member</option>
              <option value="association">Association</option>
            </select>
          </Field>
          <Field label="Category" hint="e.g. Pineapples, Vegetables, Cocoa">
            <input
              value={entry.category}
              onChange={(e) => set("category", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Company / Association name *">
            <input
              value={entry.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              className={inputCls}
              disabled={locked}
              required
            />
          </Field>
          <Field
            label="Slug"
            hint={entry.slug ? `Live URL: /directory/${entry.slug}` : "Auto-generated on save"}
          >
            <input
              value={entry.slug}
              onChange={(e) =>
                set(
                  "slug",
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]+/g, "-")
                    .replace(/^-|-$/g, ""),
                )
              }
              className={inputCls + " font-mono text-xs"}
              disabled={locked}
              placeholder="auto"
            />
          </Field>
        </div>

        <Field label="Short description (shown on directory card)">
          <textarea
            value={entry.short_description}
            onChange={(e) => set("short_description", e.target.value)}
            rows={2}
            className={inputCls}
            disabled={locked}
          />
        </Field>

        <Field label="About / Long description">
          <textarea
            value={entry.long_description}
            onChange={(e) => set("long_description", e.target.value)}
            rows={4}
            className={inputCls}
            disabled={locked}
          />
        </Field>

        {entry.entry_type === "association" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Mission">
              <textarea
                value={entry.mission}
                onChange={(e) => set("mission", e.target.value)}
                rows={3}
                className={inputCls}
                disabled={locked}
              />
            </Field>
            <Field label="Vision">
              <textarea
                value={entry.vision}
                onChange={(e) => set("vision", e.target.value)}
                rows={3}
                className={inputCls}
                disabled={locked}
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Logo">
            <UploadBlock
              url={entry.logo_url}
              busy={uploading === "logo"}
              onPick={(f) => handleUpload(f, "logo")}
              onClear={() => set("logo_url", "")}
              disabled={locked}
            />
          </Field>
          <Field label="Cover image">
            <UploadBlock
              url={entry.cover_image_url}
              busy={uploading === "cover"}
              onPick={(f) => handleUpload(f, "cover")}
              onClear={() => set("cover_image_url", "")}
              disabled={locked}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Products (comma-separated)">
            <input
              value={entry.products.join(", ")}
              onChange={(e) =>
                set(
                  "products",
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Services (one per line)">
            <textarea
              value={entry.services.join("\n")}
              onChange={(e) =>
                set(
                  "services",
                  e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                )
              }
              rows={3}
              className={inputCls}
              disabled={locked}
            />
          </Field>
        </div>

        {entry.entry_type === "association" && (
          <Field label="Executives">
            <ExecutivesEditor
              value={entry.executives}
              onChange={(v) => set("executives", v)}
              disabled={locked}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Director / Lead name">
            <input
              value={entry.director_name}
              onChange={(e) => set("director_name", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Primary contact name">
            <input
              value={entry.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Phone">
            <input
              value={entry.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={entry.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Website">
            <input
              value={entry.website}
              onChange={(e) => set("website", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Region">
            <input
              value={entry.region}
              onChange={(e) => set("region", e.target.value)}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Physical address">
            <textarea
              value={entry.physical_address}
              onChange={(e) => set("physical_address", e.target.value)}
              rows={2}
              className={inputCls}
              disabled={locked}
            />
          </Field>
          <Field label="Postal address">
            <textarea
              value={entry.postal_address}
              onChange={(e) => set("postal_address", e.target.value)}
              rows={2}
              className={inputCls}
              disabled={locked}
            />
          </Field>
        </div>
      </div>

      {defs.length > 0 && (
        <div className="space-y-3 rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="text-base font-bold">Additional information</h3>
          {defs
            .filter((d) => d.applies_to === "both" || d.applies_to === entry.entry_type)
            .map((d) => (
              <fieldset
                key={d.id}
                disabled={locked}
                className={locked ? "opacity-60" : undefined}
              >
                <DynamicFieldRenderer
                  def={d}
                  value={entry.custom_fields?.[d.key]}
                  onChange={(v) => setCustom(d.key, v)}
                  uploadFolder="directory/custom"
                />
              </fieldset>
            ))}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || locked}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={busy || locked}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit for review
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function UploadBlock({
  url,
  busy,
  onPick,
  onClear,
  disabled,
}: {
  url: string;
  busy: boolean;
  onPick: (f: File) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {url && (
        <img src={url} alt="" className="h-14 w-14 rounded-lg object-cover" />
      )}
      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <Upload className="h-4 w-4" />
        {busy ? "Uploading…" : url ? "Replace" : "Upload"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </label>
      {url && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="inline h-3 w-3" /> Remove
        </button>
      )}
    </div>
  );
}

function ExecutivesEditor({
  value,
  onChange,
  disabled,
}: {
  value: { role: string; name: string }[];
  onChange: (v: { role: string; name: string }[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {value.map((ex, i) => (
        <div key={i} className="flex gap-2">
          <input
            placeholder="Role"
            value={ex.role}
            disabled={disabled}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...next[i], role: e.target.value };
              onChange(next);
            }}
            className={inputCls}
          />
          <input
            placeholder="Name"
            value={ex.name}
            disabled={disabled}
            onChange={(e) => {
              const next = [...value];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            className={inputCls}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded-lg p-2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...value, { role: "", name: "" }])}
        className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
      >
        <Plus className="h-3 w-3" /> Add executive
      </button>
    </div>
  );
}
