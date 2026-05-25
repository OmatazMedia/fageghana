import { useState } from "react";

export type FormField = {
  id: string;
  type: string;
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: string[];
};

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function DynamicForm({
  schema,
  onSubmit,
  busy,
}: {
  schema: FormField[];
  onSubmit: (answers: Record<string, any>) => void;
  busy?: boolean;
}) {
  const [values, setValues] = useState<Record<string, any>>({});
  function set(name: string, v: any) {
    setValues((s) => ({ ...s, [name]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      {schema.map((f) => {
        if (f.type === "heading")
          return (
            <h3 key={f.id} className="mt-4 border-b border-border pb-2 text-lg font-bold">
              {f.label}
            </h3>
          );
        if (f.type === "checkbox")
          return (
            <label key={f.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                required={f.required}
                checked={!!values[f.name]}
                onChange={(e) => set(f.name, e.target.checked)}
              />
              <span>
                {f.label} {f.required && <span className="text-primary">*</span>}
              </span>
            </label>
          );
        return (
          <div key={f.id}>
            <label className="mb-1.5 block text-sm font-medium">
              {f.label} {f.required && <span className="text-primary">*</span>}
            </label>
            {renderInput(f, values, set)}
            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          </div>
        );
      })}
      <button
        disabled={busy}
        className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

function renderInput(f: FormField, values: Record<string, any>, set: (n: string, v: any) => void) {
  const v = values[f.name] ?? (f.type === "checkboxes" ? [] : "");
  switch (f.type) {
    case "paragraph":
      return (
        <textarea
          required={f.required}
          placeholder={f.placeholder}
          rows={4}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
    case "select":
      return (
        <select
          required={f.required}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        >
          <option value="">{f.placeholder ?? "Select…"}</option>
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "radio":
      return (
        <div className="space-y-1">
          {(f.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={f.name}
                required={f.required}
                value={o}
                checked={v === o}
                onChange={() => set(f.name, o)}
              />{" "}
              {o}
            </label>
          ))}
        </div>
      );
    case "checkboxes":
      return (
        <div className="space-y-1">
          {(f.options ?? []).map((o) => {
            const arr: string[] = Array.isArray(v) ? v : [];
            const checked = arr.includes(o);
            return (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => set(f.name, checked ? arr.filter((x) => x !== o) : [...arr, o])}
                />{" "}
                {o}
              </label>
            );
          })}
        </div>
      );
    case "file":
      return (
        <input
          type="file"
          required={f.required}
          onChange={(e) => set(f.name, e.target.files?.[0]?.name ?? "")}
          className={inputCls}
        />
      );
    case "date":
      return (
        <input
          type="date"
          required={f.required}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
    case "number":
      return (
        <input
          type="number"
          required={f.required}
          placeholder={f.placeholder}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
    case "email":
      return (
        <input
          type="email"
          required={f.required}
          placeholder={f.placeholder}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          required={f.required}
          placeholder={f.placeholder}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
    default:
      return (
        <input
          type="text"
          required={f.required}
          placeholder={f.placeholder}
          value={v}
          onChange={(e) => set(f.name, e.target.value)}
          className={inputCls}
        />
      );
  }
}
