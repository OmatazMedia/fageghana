// @ts-nocheck
import { api } from "@/integrations/api/client";
import JSZip from "jszip";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

function downloadBase() {
  return (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "/api";
}

async function resolveBackupId(path: string): Promise<string> {
  const id = path.includes("/") ? path.split("/").pop() : path;
  return (id || "").replace(/\.(zip|json|tar\.gz)$/i, "");
}

function computeNextRun(
  schedule: {
    frequency: string;
    hour_of_day: number;
    minute_of_hour: number;
    day_of_week: number;
    day_of_month: number;
    cron_expression?: string | null;
  },
  from: Date = new Date(),
): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);
  switch (schedule.frequency) {
    case "hourly":
      next.setMinutes(schedule.minute_of_hour);
      if (next <= from) next.setHours(next.getHours() + 1);
      return next;
    case "daily": {
      next.setHours(schedule.hour_of_day, schedule.minute_of_hour, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }
    case "weekly": {
      next.setHours(schedule.hour_of_day, schedule.minute_of_hour, 0, 0);
      const target = ((schedule.day_of_week % 7) + 7) % 7;
      const delta = (target - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + delta);
      if (next <= from) next.setDate(next.getDate() + 7);
      return next;
    }
    case "monthly": {
      next.setDate(Math.max(1, Math.min(28, schedule.day_of_month)));
      next.setHours(schedule.hour_of_day, schedule.minute_of_hour, 0, 0);
      if (next <= from) next.setMonth(next.getMonth() + 1);
      return next;
    }
    default: {
      next.setHours(schedule.hour_of_day, schedule.minute_of_hour, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }
  }
}

export async function createBackup(input: any): Promise<any> {
  const data = input?.data ?? input;
  const { data: res, error } = await api.request("/admin/backups/create", {
    method: "POST",
    body: JSON.stringify({ include_media: data?.include_media ?? true }),
  });
  if (error) throw new Error(error.message);
  const b = res?.backup ?? res ?? {};
  return {
    filename: b.filename ?? b.name ?? null,
    path: b.path ?? null,
    url: b.url ?? null,
    manifest: b.manifest ?? null,
    log: b.log ?? [],
    sizeBytes: b.sizeBytes ?? b.size_bytes ?? null,
  };
}

export async function getBackupSchedule(input: any): Promise<any> {
  const { data: res, error } = await api.request("/admin/backups/config");
  if (error) throw new Error(error.message);
  return { schedule: res?.config ?? null };
}

export async function updateBackupSchedule(input: any): Promise<any> {
  const data = input?.data ?? input;
  const { enabled, frequency, hour_of_day, minute_of_hour, day_of_week, day_of_month, retention_days } = data;
  const { data: res, error } = await api.request("/admin/backups/config", {
    method: "PUT",
    body: JSON.stringify({
      enabled,
      frequency,
      retention_days,
      hour_of_day,
      minute_of_hour,
      day_of_week,
      day_of_month,
    }),
  });
  if (error) throw new Error(error.message);
  const next = computeNextRun({
    frequency,
    hour_of_day,
    minute_of_hour,
    day_of_week,
    day_of_month,
  });
  return { schedule: { ...data, next_run_at: enabled ? next.toISOString() : null } };
}

export async function listBackupRuns(input: any): Promise<any> {
  const { data: res, error } = await api.request("/admin/backups");
  if (error) throw new Error(error.message);
  const rows = unwrap(res);
  return { runs: Array.isArray(rows) ? rows : [] };
}

export async function getMemberIdNext(): Promise<any> {
  const { data: rows } = await api
    .from("member_id_counters")
    .select("*")
    .ilike("year_abbrev", "%MEMBER")
    .limit(1);
  const row = Array.isArray(rows) ? rows[0] : null;
  return { next: Number(row?.next_seq ?? 1) };
}

export async function setMemberIdStart(input: any): Promise<any> {
  const data = input?.data ?? input;
  if (!Number.isInteger(data?.next) || data?.next < 1) {
    throw new Error("Must be a positive integer");
  }
  const { data: rows } = await api
    .from("member_id_counters")
    .select("*")
    .ilike("year_abbrev", "%MEMBER")
    .limit(1);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (row) {
    const { error } = await api.from("member_id_counters").update({ next_seq: data.next }).eq("id", row.id);
    if (error) throw new Error(error.message);
  } else {
    const yearCode = String(new Date().getFullYear() % 100).padStart(4, "0");
    const { error } = await api
      .from("member_id_counters")
      .insert({ year_abbrev: `${yearCode}-MEMBER`, next_seq: data.next });
    if (error) throw new Error(error.message);
  }
  return { next: Number(data.next) };
}

export async function listBackups(input: any): Promise<any> {
  const { data: res, error } = await api.request("/admin/backups");
  if (error) throw new Error(error.message);
  const rows = unwrap(res);
  const base = downloadBase();
  const backups = (Array.isArray(rows) ? rows : []).map((r: any) => ({
    name: r.file_name ?? r.filename ?? r.storage_path ?? r.path ?? r.id,
    size: r.size_bytes ?? r.size ?? 0,
    created_at: r.started_at ?? r.created_at,
    url: `${base}/admin/backups/${r.id}/download`,
  }));
  return { backups };
}

export async function parseBackupManifest(input: any): Promise<any> {
  const data = input?.data ?? input;
  try {
    const id = await resolveBackupId(data?.path ?? "");
    const token = api.getToken();
    const res = await fetch(`${downloadBase()}/admin/backups/${encodeURIComponent(id)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { ok: false as const, error: `Download failed: HTTP ${res.status}` };
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const mf = zip.file("manifest.json");
    if (!mf) return { ok: false as const, error: "Invalid backup: manifest.json missing" };
    const manifest = JSON.parse(await mf.async("string"));
    return { ok: true as const, manifest };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || String(e) };
  }
}

export async function restoreBackup(input: any): Promise<any> {
  const data = input?.data ?? input;
  const summary = { tables: 0, rows: 0, files: 0, users: 0, errors: 0 };
  try {
    const id = await resolveBackupId(data?.path ?? "");
    const { data: res, error } = await api.request(`/admin/backups/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      body: JSON.stringify({ mode: data?.mode ?? "merge" }),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, summary, log: [res?.message ?? "Restore completed"] };
  } catch (e: any) {
    return {
      ok: false as const,
      summary,
      log: [`[ERROR] Restore: ${e?.message || e}`],
      error: e?.message || String(e),
    };
  }
}