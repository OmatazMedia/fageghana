import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { testBackupDestination } from "@/lib/backup-destinations.functions";
import { toast } from "sonner";
import {
  CloudUpload,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  X,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/admin/backup-destinations")({
  head: () => ({ meta: [{ title: "Backup Destinations — Admin" }] }),
  component: BackupDestinationsPage,
});

type Provider = "google_drive" | "aws_s3" | "dropbox" | "sftp" | "webhook";
type Dest = {
  id: string;
  name: string;
  provider: Provider;
  config: any;
  enabled: boolean;
  is_default: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
};

const PROVIDER_LABEL: Record<Provider, string> = {
  google_drive: "Google Drive",
  aws_s3: "AWS S3",
  dropbox: "Dropbox",
  sftp: "SFTP",
  webhook: "Webhook",
};

function BackupDestinationsPage() {
  const [rows, setRows] = useState<Dest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Dest | null>(null);
  const testFn = useServerFn(testBackupDestination);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("backup_destinations" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as Dest[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleEnabled(row: Dest) {
    const { error } = await supabase
      .from("backup_destinations" as any)
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  }

  async function makeDefault(row: Dest) {
    await supabase.from("backup_destinations" as any).update({ is_default: false }).neq("id", row.id);
    const { error } = await supabase
      .from("backup_destinations" as any)
      .update({ is_default: true })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(`${row.name} is now the default destination`);
    load();
  }

  async function remove(row: Dest) {
    if (!confirm(`Delete "${row.name}"?`)) return;
    const { error } = await supabase.from("backup_destinations" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Destination deleted");
    load();
  }

  async function runTest(row: Dest) {
    const t = toast.loading(`Testing ${row.name}…`);
    try {
      const res = await testFn({ data: { provider: row.provider, config: row.config } });
      await supabase
        .from("backup_destinations" as any)
        .update({
          last_test_at: new Date().toISOString(),
          last_test_ok: res.ok,
          last_test_message: res.message,
        })
        .eq("id", row.id);
      toast.dismiss(t);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      load();
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Test failed");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Backup Destinations</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Send scheduled and manual backups to your own storage — Google Drive, S3, Dropbox, SFTP, or a webhook. Credentials stay in your database and are only readable by admins.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add destination
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border bg-white p-10 text-center">
          <CloudUpload className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm text-slate-600">No destinations configured yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Provider</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">Last test</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    {r.is_default && (
                      <span className="text-[10px] uppercase font-semibold text-emerald-700">Default</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{PROVIDER_LABEL[r.provider]}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabled(r)}
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {r.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.last_test_at ? (
                      <div className="flex items-center gap-1">
                        {r.last_test_ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className="truncate max-w-[240px]" title={r.last_test_message ?? ""}>
                          {new Date(r.last_test_at).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => runTest(r)}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        <RefreshCw className="h-3 w-3" /> Test
                      </button>
                      {!r.is_default && (
                        <button
                          onClick={() => makeDefault(r)}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Set default
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditing(r);
                          setShowForm(true);
                        }}
                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(r)}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <DestinationForm
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DestinationForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Dest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? "google_drive");
  const [name, setName] = useState(initial?.name ?? "");
  const [config, setConfig] = useState<Record<string, string>>({
    service_account_json: initial?.config?.service_account_json ?? "",
    folder_id: initial?.config?.folder_id ?? "",
    // s3
    region: initial?.config?.region ?? "",
    bucket: initial?.config?.bucket ?? "",
    access_key_id: initial?.config?.access_key_id ?? "",
    secret_access_key: initial?.config?.secret_access_key ?? "",
    prefix: initial?.config?.prefix ?? "",
    // dropbox
    refresh_token: initial?.config?.refresh_token ?? "",
    app_key: initial?.config?.app_key ?? "",
    app_secret: initial?.config?.app_secret ?? "",
    // sftp
    host: initial?.config?.host ?? "",
    port: initial?.config?.port ?? "",
    username: initial?.config?.username ?? "",
    password: initial?.config?.password ?? "",
    remote_path: initial?.config?.remote_path ?? "",
    // webhook
    url: initial?.config?.url ?? "",
    secret: initial?.config?.secret ?? "",
  });
  const [saving, setSaving] = useState(false);
  const testFn = useServerFn(testBackupDestination);

  function set(k: string, v: string) {
    setConfig((c) => ({ ...c, [k]: v }));
  }

  function pickedConfig() {
    switch (provider) {
      case "google_drive":
        return { service_account_json: config.service_account_json, folder_id: config.folder_id };
      case "aws_s3":
        return {
          region: config.region,
          bucket: config.bucket,
          access_key_id: config.access_key_id,
          secret_access_key: config.secret_access_key,
          prefix: config.prefix,
        };
      case "dropbox":
        return {
          refresh_token: config.refresh_token,
          app_key: config.app_key,
          app_secret: config.app_secret,
          folder: config.folder_id,
        };
      case "sftp":
        return {
          host: config.host,
          port: config.port ? Number(config.port) : 22,
          username: config.username,
          password: config.password,
          remote_path: config.remote_path,
        };
      case "webhook":
        return { url: config.url, secret: config.secret };
    }
  }

  async function save() {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      name: name.trim(),
      provider,
      config: pickedConfig(),
    };
    try {
      if (initial) {
        const { error } = await supabase
          .from("backup_destinations" as any)
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("backup_destinations" as any).insert(payload as any);
        if (error) throw error;
      }
      toast.success("Saved");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    const t = toast.loading("Testing…");
    try {
      const res = await testFn({ data: { provider, config: pickedConfig() } });
      toast.dismiss(t);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message, { duration: 8000 });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message ?? "Test failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">
            {initial ? "Edit destination" : "New destination"}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="e.g. FAGE Google Drive"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-white"
              >
                <option value="google_drive">Google Drive (service account)</option>
                <option value="aws_s3">AWS S3</option>
                <option value="dropbox">Dropbox</option>
                <option value="sftp">SFTP</option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>

          {provider === "google_drive" && (
            <>
              <SetupGuide
                title="How to connect Google Drive"
                steps={[
                  "Go to console.cloud.google.com and create (or select) a project.",
                  'In "APIs & Services → Library" enable the Google Drive API.',
                  'In "IAM & Admin → Service Accounts" create a new service account.',
                  "Open the service account → Keys → Add key → Create new key → JSON. A JSON file downloads.",
                  "In Google Drive create a folder for backups, right-click it → Share → paste the service account email (client_email) → give Editor access.",
                  "Copy the folder ID from its URL (drive.google.com/drive/folders/<FOLDER_ID>) into the field below.",
                  'Paste the full JSON key file contents into "Service account JSON" and click Test connection.',
                ]}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">Service account JSON</label>
                <textarea
                  value={config.service_account_json}
                  onChange={(e) => set("service_account_json", e.target.value)}
                  rows={7}
                  className="w-full rounded-md border px-3 py-2 text-xs font-mono"
                  placeholder='{"type":"service_account","project_id":"…","private_key":"…","client_email":"…"}'
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Drive folder ID (optional)</label>
                <input
                  value={config.folder_id}
                  onChange={(e) => set("folder_id", e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                  placeholder="1A2b3C4d5E6f7G8h9I0jK…"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave blank to upload to the service account's Drive root. Shared Drive folders are supported when the service account is a member.
                </p>
              </div>
            </>
          )}

          {provider === "aws_s3" && (
            <>
              <SetupGuide
                title="How to connect AWS S3"
                steps={[
                  "In AWS Console → IAM, create a user with Programmatic access.",
                  'Attach a policy that allows s3:PutObject, s3:ListBucket, s3:GetObject on the target bucket.',
                  "Save the Access Key ID and Secret Access Key AWS shows you (they are shown only once).",
                  "Create (or pick) an S3 bucket in your chosen region. Optionally set a prefix like `fage-backups/`.",
                  "Paste all four values below and click Test connection.",
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Region" value={config.region} onChange={(v) => set("region", v)} placeholder="us-east-1" />
                <Field label="Bucket" value={config.bucket} onChange={(v) => set("bucket", v)} placeholder="my-backups" />
                <Field label="Access Key ID" value={config.access_key_id} onChange={(v) => set("access_key_id", v)} />
                <Field label="Secret Access Key" value={config.secret_access_key} onChange={(v) => set("secret_access_key", v)} type="password" />
                <Field label="Prefix (optional)" value={config.prefix} onChange={(v) => set("prefix", v)} placeholder="fage-backups/" />
              </div>
            </>
          )}

          {provider === "dropbox" && (
            <>
              <SetupGuide
                title="How to connect Dropbox"
                steps={[
                  "Go to dropbox.com/developers/apps and create a new Scoped App with files.content.write access.",
                  "Copy the App key and App secret.",
                  "Follow Dropbox's OAuth flow to obtain a long-lived refresh token (see Dropbox docs).",
                  "Paste all three values below and set an optional folder path.",
                ]}
              />
              <Field label="App key" value={config.app_key} onChange={(v) => set("app_key", v)} />
              <Field label="App secret" value={config.app_secret} onChange={(v) => set("app_secret", v)} type="password" />
              <Field label="Refresh token" value={config.refresh_token} onChange={(v) => set("refresh_token", v)} type="password" />
              <Field label="Folder path" value={config.folder_id} onChange={(v) => set("folder_id", v)} placeholder="/FAGE Backups" />
            </>
          )}

          {provider === "sftp" && (
            <>
              <SetupGuide
                title="How to connect SFTP"
                steps={[
                  "Ensure the target server accepts SFTP over the internet (public IP or accessible hostname).",
                  "Create a dedicated backup user with write access to the destination directory.",
                  "Enter host, port, username, password, and remote path below.",
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Host" value={config.host} onChange={(v) => set("host", v)} placeholder="sftp.example.com" />
                <Field label="Port" value={config.port} onChange={(v) => set("port", v)} placeholder="22" />
                <Field label="Username" value={config.username} onChange={(v) => set("username", v)} />
                <Field label="Password" value={config.password} onChange={(v) => set("password", v)} type="password" />
                <Field label="Remote path" value={config.remote_path} onChange={(v) => set("remote_path", v)} placeholder="/backups/fage" />
              </div>
            </>
          )}

          {provider === "webhook" && (
            <>
              <SetupGuide
                title="How to connect a Webhook"
                steps={[
                  "Provide a HTTPS endpoint that accepts POST with multipart form-data containing the backup file.",
                  "Optionally set a shared secret — it will be sent as `x-backup-signature` (HMAC-SHA256 of the body).",
                ]}
              />
              <Field label="Webhook URL" value={config.url} onChange={(v) => set("url", v)} placeholder="https://your-server.com/backups" />
              <Field label="Shared secret (optional)" value={config.secret} onChange={(v) => set("secret", v)} type="password" />
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t px-5 py-3 bg-slate-50 rounded-b-xl">
          <button
            onClick={test}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-white"
          >
            <RefreshCw className="h-4 w-4" /> Test connection
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border px-3 py-2 text-sm hover:bg-white">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border px-3 py-2 text-sm"
        autoComplete="off"
      />
    </div>
  );
}

function SetupGuide({ title, steps }: { title: string; steps: string[] }) {
  return (
    <details className="rounded-lg border bg-blue-50/60 open:bg-blue-50">
      <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-900">
        <BookOpen className="h-4 w-4" /> {title}
      </summary>
      <ol className="list-decimal pl-8 pr-3 pb-3 pt-1 space-y-1 text-xs text-blue-900/90">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </details>
  );
}
