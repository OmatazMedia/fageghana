import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import {
  createBackup,
  listBackups,
  parseBackupManifest,
  restoreBackup,
  getBackupSchedule,
  updateBackupSchedule,
  listBackupRuns,
} from "@/lib/backup.functions";
import {
  Download,
  Upload,
  Loader2,
  ShieldAlert,
  Database,
  HardDrive,
  Users,
  CheckCircle2,
  FileArchive,
  Trash2,
  Clock,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/admin/backup")({
  head: () => ({ meta: [{ title: "Backup & Restore — FAGE Admin" }] }),
  component: BackupPage,
});

function fmtSize(b: number) {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  return (b / Math.pow(1024, i)).toFixed(1) + " " + u[i];
}

function BackupPage() {
  const runBackup = useServerFn(createBackup);
  const runList = useServerFn(listBackups);
  const runParse = useServerFn(parseBackupManifest);
  const runRestore = useServerFn(restoreBackup);
  const runGetSchedule = useServerFn(getBackupSchedule);
  const runUpdateSchedule = useServerFn(updateBackupSchedule);
  const runListRuns = useServerFn(listBackupRuns);

  const [schedule, setSchedule] = useState<any>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [runs, setRuns] = useState<any[]>([]);

  const [busy, setBusy] = useState<"idle" | "backing" | "uploading" | "parsing" | "restoring">(
    "idle",
  );
  const [log, setLog] = useState<string[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [manifest, setManifest] = useState<any | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [mode, setMode] = useState<"merge" | "overwrite">("merge");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function downloadBackup(path: string, filename = path) {
    const { data, error } = await supabase.storage.from("backups").download(path);
    if (error || !data) {
      toast.error(error?.message ?? "Could not download backup");
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob([data], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename.endsWith(".zip") ? filename : `${filename}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  async function refresh() {
    try {
      const [r, s, rr] = await Promise.all([
        runList(),
        runGetSchedule().catch(() => ({ schedule: null })),
        runListRuns().catch(() => ({ runs: [] })),
      ]);
      setBackups(r.backups ?? []);
      setSchedule(
        s.schedule ?? {
          enabled: false,
          frequency: "daily",
          hour_of_day: 2,
          minute_of_hour: 0,
          day_of_week: 1,
          day_of_month: 1,
          retention_days: 30,
        },
      );
      setRuns(rr.runs ?? []);
    } catch (e: any) {
      console.error(e);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function saveSchedule() {
    if (!schedule) return;
    setScheduleBusy(true);
    try {
      const r = await runUpdateSchedule({
        data: {
          enabled: !!schedule.enabled,
          frequency: schedule.frequency,
          hour_of_day: Number(schedule.hour_of_day) || 0,
          minute_of_hour: Number(schedule.minute_of_hour) || 0,
          day_of_week: Number(schedule.day_of_week) || 0,
          day_of_month: Number(schedule.day_of_month) || 1,
          retention_days: Number(schedule.retention_days) || 30,
        },
      });
      setSchedule(r.schedule);
      toast.success(
        schedule.enabled ? "Schedule saved — next run set" : "Schedule disabled",
      );
    } catch (e: any) {
      toast.error(e?.message || "Could not save schedule");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function handleCreate() {
    setBusy("backing");
    setLog(["Starting backup…"]);
    setProgress(5);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 3, 90)), 600);
    try {
      const r = await runBackup();
      setProgress(100);
      setLog(r.log ?? []);
      toast.success(`Backup ready (${fmtSize(r.sizeBytes)})`);
      await downloadBackup(r.path, r.filename);
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
      setLog((l) => [...l, "Error: " + e.message]);
    } finally {
      clearInterval(tick);
      setTimeout(() => setProgress(0), 1500);
      setBusy("idle");
    }
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Please drop a .zip backup file");
      return;
    }
    setBusy("uploading");
    setLog([`Uploading ${file.name}…`]);
    setProgress(10);
    try {
      const path = `incoming-${Date.now()}-${file.name}`;
      const up = await supabase.storage.from("backups").upload(path, file, { upsert: true });
      if (up.error) throw up.error;
      setProgress(60);
      setBusy("parsing");
      setLog((l) => [...l, "Reading manifest…"]);
      const r = await runParse({ data: { path } });
      if (!r.ok) {
        toast.error(r.error);
        setLog((l) => [...l, "Error: " + r.error]);
        return;
      }
      setManifest(r.manifest);
      setPendingPath(path);
      setShowConfirm(true);
      setProgress(100);
    } catch (e: any) {
      toast.error(e.message);
      setLog((l) => [...l, "Error: " + e.message]);
    } finally {
      setTimeout(() => setProgress(0), 800);
      setBusy("idle");
    }
  }

  async function executeRestore() {
    if (!pendingPath) return;
    if (confirmText !== "RESTORE") {
      toast.error("Type RESTORE to confirm");
      return;
    }
    setShowConfirm(false);
    setBusy("restoring");
    setProgress(5);
    setLog(["Restore in progress — do not close this tab…"]);
    const tick = setInterval(() => setProgress((p) => Math.min(p + 2, 92)), 800);
    try {
      const r = await runRestore({ data: { path: pendingPath, mode } });
      setProgress(100);
      setLog(r.log ?? []);
      if (!r.ok) {
        toast.error(r.error || "Restore failed — see log");
      } else if (r.summary.errors > 0) {
        toast.warning(`Restore finished with ${r.summary.errors} errors — see log`);
      } else {
        toast.success(
          `Restore complete: ${r.summary.rows} rows, ${r.summary.files} files, ${r.summary.users} users`,
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Restore failed");
      setLog((l) => [...l, "Error: " + (e?.message || String(e))]);
    } finally {
      clearInterval(tick);
      setTimeout(() => setProgress(0), 1500);
      setBusy("idle");
      setPendingPath(null);
      setManifest(null);
      setConfirmText("");
    }
  }

  async function deleteBackup(name: string) {
    if (!confirm(`Delete backup ${name}?`)) return;
    const { error } = await supabase.storage.from("backups").remove([name]);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      void refresh();
    }
  }

  const isBusy = busy !== "idle";

  return (
    <AdminShell
      title="Backup & Restore"
      description="Full-system snapshot of database, storage, and auth users."
    >
      {/* Progress bar */}
      {progress > 0 && (
        <div className="mb-6">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span className="capitalize">{busy === "idle" ? "Done" : busy + "…"}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
              style={{ width: progress + "%" }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Backup card */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">Create backup</h2>
              <p className="text-xs text-muted-foreground">
                Snapshots the entire backend into a downloadable .zip
              </p>
            </div>
          </div>
          <ul className="mb-4 space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5" /> All public tables + RLS policies + functions
            </li>
            <li className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5" /> Storage buckets: content, payment-proofs,
              certificate-assets
            </li>
            <li className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" /> Auth users (passwords excluded — see warning below)
            </li>
          </ul>
          <button
            onClick={handleCreate}
            disabled={isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "backing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {busy === "backing" ? "Generating snapshot…" : "Generate backup"}
          </button>
        </div>

        {/* Restore card */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">Restore from backup</h2>
              <p className="text-xs text-muted-foreground">
                Drop a .zip backup to merge or overwrite this project
              </p>
            </div>
          </div>
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void handleFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
              dragOver
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50"
            } ${isBusy ? "pointer-events-none opacity-60" : ""}`}
          >
            <FileArchive
              className={`mb-3 h-10 w-10 ${dragOver ? "text-primary" : "text-muted-foreground"}`}
            />
            <p className="text-sm font-medium">Drop backup .zip here</p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </label>
        </div>
      </div>

      {/* Warnings */}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <div className="mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-4 w-4" /> Important warnings
        </div>
        <ul className="list-disc space-y-1 pl-5 text-amber-900/80 dark:text-amber-100/80">
          <li>
            <strong>Overwrite</strong> truncates every table and empties storage buckets in this
            project — there is no undo.
          </li>
          <li>
            <strong>Auth passwords are not included.</strong> Restored users keep their email &
            metadata but must reset their password on first login.
          </li>
          <li>
            <strong>Missing tables / buckets are auto-created</strong> from the backup's schema
            files before data import.
          </li>
          <li>
            <strong>Project secrets</strong> (Paystack, Hubtel, etc.) are NOT in the backup — re-add
            them in Cloud settings on the destination project.
          </li>
          <li>
            The currently-signed-in admin account is preserved during overwrite to prevent lockout.
          </li>
        </ul>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            {busy === "idle" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            Activity log
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-xs">
            {log.join("\n")}
          </pre>
        </div>
      )}

      {/* Existing backups */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-3 font-bold">Saved backups</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No backups stored yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">File</th>
                <th className="px-2 py-2 text-left">Size</th>
                <th className="px-2 py-2 text-left">Created</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.name} className="border-t border-border">
                  <td className="px-2 py-2 font-mono text-xs">{b.name}</td>
                  <td className="px-2 py-2">{fmtSize(b.size)}</td>
                  <td className="px-2 py-2">
                    {b.created_at ? new Date(b.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {b.url && (
                      <button
                        onClick={() => downloadBackup(b.name, b.name)}
                        className="mr-2 text-primary hover:underline"
                      >
                        Download
                      </button>
                    )}
                    <button
                      onClick={() => deleteBackup(b.name)}
                      className="text-destructive hover:underline"
                    >
                      <Trash2 className="inline h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && manifest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold">Confirm restore</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <div className="mb-4 rounded-lg bg-muted/40 p-3 text-sm">
              <div>
                <strong>Snapshot:</strong> {new Date(manifest.created_at).toLocaleString()}
              </div>
              <div>
                <strong>Source project:</strong> {manifest.project_ref}
              </div>
              <div>
                <strong>Tables:</strong> {Object.keys(manifest.tables || {}).length} (
                {Object.values(manifest.tables || {}).reduce((a: number, b: any) => a + b, 0)} rows)
              </div>
              <div>
                <strong>Auth users:</strong> {manifest.auth_user_count}
              </div>
              <div>
                <strong>Storage files:</strong> {manifest.storage_file_count}
              </div>
            </div>
            <div className="mb-4">
              <div className="mb-2 text-sm font-medium">Restore mode</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("merge")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left text-sm transition ${mode === "merge" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="font-semibold">Merge</div>
                  <div className="text-xs text-muted-foreground">
                    Upsert rows, skip existing files
                  </div>
                </button>
                <button
                  onClick={() => setMode("overwrite")}
                  className={`flex-1 rounded-lg border-2 p-3 text-left text-sm transition ${mode === "overwrite" ? "border-destructive bg-destructive/5" : "border-border"}`}
                >
                  <div className="font-semibold text-destructive">Overwrite</div>
                  <div className="text-xs text-muted-foreground">Truncate everything first</div>
                </button>
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium">
                Type <code className="rounded bg-muted px-1">RESTORE</code> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="RESTORE"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingPath(null);
                  setConfirmText("");
                }}
                className="rounded-lg border border-input px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeRestore}
                disabled={confirmText !== "RESTORE"}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              >
                Start restore
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
