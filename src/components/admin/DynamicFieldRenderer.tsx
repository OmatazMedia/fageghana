import { useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/uploadImage";
import { FormField, inputCls } from "@/components/admin/AdminShell";

export type CustomFieldDef = {
  id: string;
  key: string;
  label: string;
  field_type:
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "url"
    | "phone"
    | "dropdown"
    | "radio"
    | "checkboxes"
    | "image"
    | "file";
  options: string[];
  required: boolean;
  help_text: string | null;
  applies_to: "both" | "association" | "corporate";
  display_order: number;
  active: boolean;
};

export function DynamicFieldRenderer({
  def,
  value,
  onChange,
  uploadFolder = "directory/custom",
}: {
  def: CustomFieldDef;
  value: any;
  onChange: (v: any) => void;
  uploadFolder?: string;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const url = await uploadImage(file, uploadFolder);
      onChange(url);
      toast.success(`${def.label} uploaded`);
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const labelText = def.label + (def.required ? " *" : "");

  switch (def.field_type) {
    case "textarea":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </FormField>
      );
    case "number":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputCls}
          />
        </FormField>
      );
    case "email":
    case "url":
    case "phone":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <input
            type={def.field_type === "phone" ? "tel" : def.field_type}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        </FormField>
      );
    case "dropdown":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {def.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </FormField>
      );
    case "radio":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <div className="space-y-1">
            {def.options.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={def.key}
                  checked={value === o}
                  onChange={() => onChange(o)}
                />
                {o}
              </label>
            ))}
          </div>
        </FormField>
      );
    case "checkboxes": {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <div className="space-y-1">
            {def.options.map((o) => {
              const checked = arr.includes(o);
              return (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      onChange(checked ? arr.filter((x) => x !== o) : [...arr, o])
                    }
                  />
                  {o}
                </label>
              );
            })}
          </div>
        </FormField>
      );
    }
    case "image":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <div className="flex items-center gap-3">
            {value && (
              <img
                src={value}
                alt={def.label}
                className="h-14 w-14 rounded-lg object-cover"
              />
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Replace" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="inline h-3 w-3" /> Remove
              </button>
            )}
          </div>
        </FormField>
      );
    case "file":
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <div className="flex items-center gap-3">
            {value && (
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-sm text-primary hover:underline"
              >
                Current file
              </a>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : value ? "Replace" : "Upload file"}
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
            </label>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>
        </FormField>
      );
    default:
      return (
        <FormField label={labelText} hint={def.help_text ?? undefined}>
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        </FormField>
      );
  }
}

export function renderCustomFieldValue(def: CustomFieldDef, value: any) {
  if (value === null || value === undefined || value === "") return null;
  switch (def.field_type) {
    case "image":
      return <img src={value} alt={def.label} className="max-h-56 rounded-lg object-cover" />;
    case "file":
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Download
        </a>
      );
    case "url":
      return (
        <a
          href={String(value).startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary hover:underline"
        >
          {value}
        </a>
      );
    case "checkboxes":
      return (
        <div className="flex flex-wrap gap-1.5">
          {(Array.isArray(value) ? value : []).map((v: string) => (
            <span key={v} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
              {v}
            </span>
          ))}
        </div>
      );
    case "textarea":
      return <p className="whitespace-pre-line text-foreground/80">{String(value)}</p>;
    default:
      return <span>{String(value)}</span>;
  }
}
