// Server-only backup runner. Shared by createBackup (manual) and the
// scheduled cron route. Do NOT import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import JSZip from "jszip";

const BUCKETS_TO_BACKUP = ["content", "payment-proofs", "certificate-assets"];
const PAGE = 1000;

function quoteIdent(name: string) {
  return '"' + name.replace(/"/g, '""') + '"';
}
function quoteLit(value: string) {
  return "'" + value.replace(/'/g, "''") + "'";
}

function buildEnumsSQL(enums: Array<{ name: string; values: string[] }>) {
  return enums
    .map(
      (e) =>
        `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = ${quoteLit(e.name)}) THEN
    CREATE TYPE public.${quoteIdent(e.name)} AS ENUM (${(e.values || []).map(quoteLit).join(", ")});
  END IF;
END $$;`,
    )
    .join("\n\n");
}

function buildTablesSQL(
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; notnull: boolean; default: string | null }>;
    pk: string[] | null;
  }>,
) {
  return tables
    .map((t) => {
      const cols = (t.columns || [])
        .map((c) => {
          const def = c.default ? ` DEFAULT ${c.default}` : "";
          const nn = c.notnull ? " NOT NULL" : "";
          return `  ${quoteIdent(c.name)} ${c.type}${nn}${def}`;
        })
        .join(",\n");
      const pk = t.pk && t.pk.length ? `,\n  PRIMARY KEY (${t.pk.map(quoteIdent).join(", ")})` : "";
      return `CREATE TABLE IF NOT EXISTS public.${quoteIdent(t.name)} (\n${cols}${pk}\n);\nALTER TABLE public.${quoteIdent(t.name)} ENABLE ROW LEVEL SECURITY;`;
    })
    .join("\n\n");
}

function buildPoliciesSQL(
  policies: Array<{
    schemaname: string;
    tablename: string;
    policyname: string;
    cmd: string;
    roles: string[];
    qual: string | null;
    with_check: string | null;
  }>,
) {
  return policies
    .map((p) => {
      const using = p.qual ? ` USING (${p.qual})` : "";
      const wc = p.with_check ? ` WITH CHECK (${p.with_check})` : "";
      const roles = (p.roles || []).join(", ") || "public";
      return `DROP POLICY IF EXISTS ${quoteIdent(p.policyname)} ON public.${quoteIdent(p.tablename)};
CREATE POLICY ${quoteIdent(p.policyname)} ON public.${quoteIdent(p.tablename)} FOR ${p.cmd} TO ${roles}${using}${wc};`;
    })
    .join("\n\n");
}

async function listAllStorageFiles(bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || (item.metadata == null && !item.name.includes("."))) {
        const sub = await listAllStorageFiles(bucket, path);
        out.push(...sub);
      } else {
        out.push(path);
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

export type BackupTrigger = "manual" | "scheduled";

export async function runBackupCore(trigger: BackupTrigger) {
  // Open a run row
  const runIns = await supabaseAdmin
    .from("backup_runs")
    .insert({ trigger, status: "running" })
    .select("id")
    .single();
  const runId = runIns.data?.id as string | undefined;

  const log: string[] = [];
  const counts: Record<string, number> = {};

  try {
    const zip = new JSZip();

    const [enumsRes, tablesRes, fnsRes, polRes, seqRes] = await Promise.all([
      supabaseAdmin.rpc("admin_list_enums"),
      supabaseAdmin.rpc("admin_list_tables"),
      supabaseAdmin.rpc("admin_list_functions"),
      supabaseAdmin.rpc("admin_list_policies"),
      supabaseAdmin.rpc("admin_list_sequences"),
    ]);
    if (enumsRes.error) throw new Error("enums: " + enumsRes.error.message);
    if (tablesRes.error) throw new Error("tables: " + tablesRes.error.message);

    const enums = (enumsRes.data as any[]) || [];
    const tables = (tablesRes.data as any[]) || [];
    const fns = (fnsRes.data as any[]) || [];
    const policies = (polRes.data as any[]) || [];
    const sequences = (seqRes.data as any[]) || [];

    zip.file("schema/enums.sql", buildEnumsSQL(enums));
    zip.file("schema/tables.sql", buildTablesSQL(tables));
    zip.file("schema/policies.sql", buildPoliciesSQL(policies));
    zip.file("schema/functions.sql", fns.map((f: any) => f.definition + ";").join("\n\n"));
    zip.file(
      "schema/sequences.sql",
      sequences
        .map((s: any) => `CREATE SEQUENCE IF NOT EXISTS public.${quoteIdent(s.name)};`)
        .join("\n"),
    );
    log.push(
      `Schema: ${tables.length} tables, ${enums.length} enums, ${fns.length} functions, ${policies.length} policies`,
    );

    // Auto-discover every table so newly-added tables are included
    const discoveredRes = await supabaseAdmin.rpc("admin_list_public_tables");
    const discoveredNames: string[] = Array.isArray(discoveredRes.data)
      ? (discoveredRes.data as string[])
      : (tables.map((t: any) => t.name) as string[]);
    const allTableNames = Array.from(
      new Set([...(tables.map((t: any) => t.name) as string[]), ...discoveredNames]),
    ).sort();

    for (const tableName of allTableNames) {
      let from = 0;
      const lines: string[] = [];
      let usedFallback = false;
      while (true) {
        const { data, error } = await (supabaseAdmin as any)
          .from(tableName)
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) {
          const dumpRes = await supabaseAdmin.rpc("admin_dump_table", { _name: tableName });
          if (dumpRes.error) {
            log.push(`Skip ${tableName}: ${error.message}`);
            break;
          }
          for (const row of (dumpRes.data as any[]) ?? []) lines.push(JSON.stringify(row));
          usedFallback = true;
          break;
        }
        if (!data || data.length === 0) break;
        for (const row of data) lines.push(JSON.stringify(row));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      zip.file(`data/${tableName}.jsonl`, lines.join("\n"));
      counts[tableName] = lines.length;
      log.push(`Data: ${tableName} → ${lines.length} rows${usedFallback ? " (rpc)" : ""}`);
    }

    // Auth users
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error("auth: " + error.message);
      if (!data?.users || data.users.length === 0) break;
      allUsers.push(
        ...data.users.map((u) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          email_confirmed_at: u.email_confirmed_at,
          phone_confirmed_at: u.phone_confirmed_at,
          user_metadata: u.user_metadata,
          app_metadata: u.app_metadata,
          created_at: u.created_at,
        })),
      );
      if (data.users.length < 1000) break;
      page++;
    }
    zip.file("auth/users.json", JSON.stringify(allUsers, null, 2));
    log.push(`Auth: ${allUsers.length} users`);

    // Storage
    const bucketMeta: any[] = [];
    let totalFiles = 0;
    for (const bucket of BUCKETS_TO_BACKUP) {
      const { data: bInfo } = await supabaseAdmin.storage.getBucket(bucket);
      bucketMeta.push({ id: bucket, public: bInfo?.public ?? false });
      const files = await listAllStorageFiles(bucket);
      for (const path of files) {
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
        if (error) {
          log.push(`Skip ${bucket}/${path}: ${error.message}`);
          continue;
        }
        const buf = await data.arrayBuffer();
        zip.file(`storage/${bucket}/${path}`, buf);
        totalFiles++;
      }
      log.push(`Storage: ${bucket} → ${files.length} files`);
    }
    zip.file("storage/_buckets.json", JSON.stringify(bucketMeta, null, 2));

    const manifest = {
      version: 1,
      created_at: new Date().toISOString(),
      project_ref: process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1] || "unknown",
      tables: counts,
      auth_user_count: allUsers.length,
      storage_file_count: totalFiles,
      buckets: BUCKETS_TO_BACKUP,
      trigger,
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
    const filename = `backup-${manifest.created_at.replace(/[:.]/g, "-")}.zip`;
    const upload = await supabaseAdmin.storage.from("backups").upload(filename, blob, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upload.error) throw new Error("upload: " + upload.error.message);

    const signed = await supabaseAdmin.storage.from("backups").createSignedUrl(filename, 60 * 60);

    // Upload to configured external destinations (default first, then any other enabled).
    const destUploads: Array<{
      destination_id: string;
      provider: string;
      ok: boolean;
      message: string | null;
      external_id: string | null;
      url: string | null;
    }> = [];
    try {
      const { data: dests } = await supabaseAdmin
        .from("backup_destinations")
        .select("id, provider, config, enabled, is_default")
        .eq("enabled", true)
        .order("is_default", { ascending: false });
      if (dests && dests.length) {
        const { uploadToDestination } = await import("./backup-adapters/index.server");
        for (const d of dests as any[]) {
          const res = await uploadToDestination(d.provider, d.config ?? {}, filename, blob);
          const row = {
            destination_id: d.id as string,
            provider: d.provider as string,
            ok: res.ok,
            message: res.ok ? null : res.message,
            external_id: res.ok ? res.external_id : null,
            url: res.ok ? res.url : null,
          };
          destUploads.push(row);
          log.push(
            `Destination ${d.provider}: ${res.ok ? `uploaded (${res.external_id})` : `FAILED — ${res.message}`}`,
          );
        }
      }
    } catch (e: any) {
      log.push(`[destinations] ${e?.message ?? String(e)}`);
    }

    if (runId) {
      await supabaseAdmin
        .from("backup_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          size_bytes: blob.byteLength,
          path: filename,
          tables_count: allTableNames.length,
        })
        .eq("id", runId);
      if (destUploads.length) {
        await supabaseAdmin.from("backup_run_uploads" as any).insert(
          destUploads.map((u) => ({ ...u, run_id: runId })),
        );
      }
    }

    return {
      ok: true as const,
      filename,
      path: filename,
      url: signed.data?.signedUrl || null,
      manifest,
      log,
      sizeBytes: blob.byteLength,
      runId,
      destinations: destUploads,
    };
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (runId) {
      await supabaseAdmin
        .from("backup_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "error",
          error_message: msg,
        })
        .eq("id", runId);
    }
    log.push(`[ERROR] ${msg}`);
    throw Object.assign(new Error(msg), { log });
  }
}

// Compute next run time given schedule fields
export function computeNextRun(
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
      const target = ((schedule.day_of_week % 7) + 7) % 7; // 0=Sun
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
      // custom / unknown: default to daily
      next.setHours(schedule.hour_of_day, schedule.minute_of_hour, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      return next;
    }
  }
}

export async function pruneOldBackups(retentionDays: number) {
  if (!retentionDays || retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 86400 * 1000;
  const { data, error } = await supabaseAdmin.storage
    .from("backups")
    .list("", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });
  if (error || !data) return 0;
  const old = data.filter(
    (f) => f.created_at && new Date(f.created_at).getTime() < cutoff && f.name.endsWith(".zip"),
  );
  if (!old.length) return 0;
  await supabaseAdmin.storage.from("backups").remove(old.map((f) => f.name));
  return old.length;
}
