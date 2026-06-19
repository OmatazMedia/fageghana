import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import JSZip from "jszip";

const BUCKETS_TO_BACKUP = ["content", "payment-proofs", "certificate-assets"];
const PAGE = 1000;

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

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
        // folder
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

export const createBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { runBackupCore } = await import("./backup-runner.server");
    const res = await runBackupCore("manual");
    return {
      filename: res.filename,
      path: res.path,
      url: res.url,
      manifest: res.manifest,
      log: res.log,
      sizeBytes: res.sizeBytes,
    };
  });

export const getBackupSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("backup_schedules")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { schedule: data };
  });

export const updateBackupSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      enabled: boolean;
      frequency: "hourly" | "daily" | "weekly" | "monthly";
      hour_of_day: number;
      minute_of_hour: number;
      day_of_week: number;
      day_of_month: number;
      retention_days: number;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { computeNextRun } = await import("./backup-runner.server");
    const next = computeNextRun(data);
    const existing = await supabaseAdmin
      .from("backup_schedules")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (existing.data?.id) {
      const { data: updated, error } = await supabaseAdmin
        .from("backup_schedules")
        .update({ ...data, next_run_at: data.enabled ? next.toISOString() : null })
        .eq("id", existing.data.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { schedule: updated };
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("backup_schedules")
        .insert({ ...data, next_run_at: data.enabled ? next.toISOString() : null })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { schedule: inserted };
    }
  });

export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("backup_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data || [] };
  });

export const getMemberIdNext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.rpc("admin_get_member_id_next");
    if (error) throw new Error(error.message);
    return { next: Number(data) };
  });

export const setMemberIdStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { next: number }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (!Number.isInteger(data.next) || data.next < 1) {
      throw new Error("Must be a positive integer");
    }
    const { data: res, error } = await supabaseAdmin.rpc("admin_set_member_id_start", {
      _n: data.next,
    });
    if (error) throw new Error(error.message);
    return { next: Number(res) };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.storage
      .from("backups")
      .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw new Error(error.message);
    const results = await Promise.all(
      (data || []).map(async (f) => {
        const signed = await supabaseAdmin.storage.from("backups").createSignedUrl(f.name, 60 * 60);
        return {
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at,
          url: signed.data?.signedUrl || null,
        };
      }),
    );
    return { backups: results };
  });

export const parseBackupManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    try {
      await assertAdmin(context.userId);
      const dl = await supabaseAdmin.storage.from("backups").download(data.path);
      if (dl.error) return { ok: false as const, error: `Download failed: ${dl.error.message}` };
      const buf = await dl.data.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const mf = zip.file("manifest.json");
      if (!mf) return { ok: false as const, error: "Invalid backup: manifest.json missing" };
      const manifest = JSON.parse(await mf.async("string"));
      return { ok: true as const, manifest };
    } catch (e: any) {
      return { ok: false as const, error: e?.message || String(e) };
    }
  });

// Split SQL while respecting dollar-quoted blocks ($$ ... $$).
function splitSql(sql: string): string[] {
  const stmts: string[] = [];
  let buf = "";
  let inDollar = false;
  let i = 0;
  while (i < sql.length) {
    if (sql.slice(i, i + 2) === "$$") {
      inDollar = !inDollar;
      buf += "$$";
      i += 2;
      continue;
    }
    const ch = sql[i];
    if (ch === ";" && !inDollar) {
      const s = buf.trim();
      if (s) stmts.push(s + ";");
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; mode: "merge" | "overwrite" }) => d)
  .handler(async ({ data, context }) => {
    const log: string[] = [];
    const summary = { tables: 0, rows: 0, files: 0, users: 0, errors: 0 };
    const safeStep = async <T>(label: string, fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e: any) {
        summary.errors++;
        log.push(`[ERROR] ${label}: ${e?.message || String(e)}`);
        return null;
      }
    };

    try {
      await assertAdmin(context.userId);
    } catch (e: any) {
      return {
        ok: false as const,
        summary,
        log: [`[ERROR] Auth: ${e?.message || e}`],
        error: e?.message || String(e),
      };
    }

    const dl = await supabaseAdmin.storage.from("backups").download(data.path);
    if (dl.error) {
      return {
        ok: false as const,
        summary,
        log: [`[ERROR] Download backup: ${dl.error.message}`],
        error: dl.error.message,
      };
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(await dl.data.arrayBuffer());
    } catch (e: any) {
      return {
        ok: false as const,
        summary,
        log: [`[ERROR] Open ZIP: ${e?.message || e}`],
        error: e?.message || String(e),
      };
    }

    const mfFile = zip.file("manifest.json");
    if (!mfFile) {
      return {
        ok: false as const,
        summary,
        log: ["[ERROR] manifest.json missing in ZIP"],
        error: "manifest.json missing",
      };
    }
    const manifest = JSON.parse(await mfFile.async("string"));
    log.push(`Restoring backup from ${manifest.created_at} (mode: ${data.mode})`);

    const schemaFiles = [
      "schema/enums.sql",
      "schema/sequences.sql",
      "schema/tables.sql",
      "schema/functions.sql",
      "schema/policies.sql",
    ];
    for (const sf of schemaFiles) {
      const f = zip.file(sf);
      if (!f) continue;
      const sql = await f.async("string");
      if (!sql.trim()) continue;
      const stmts = splitSql(sql);
      let okCount = 0;
      let failCount = 0;
      for (const stmt of stmts) {
        try {
          const { error } = await supabaseAdmin.rpc("admin_exec_sql", { sql: stmt });
          if (error) {
            failCount++;
            log.push(`  [schema:${sf}] ${error.message.slice(0, 180)}`);
          } else okCount++;
        } catch (e: any) {
          failCount++;
          log.push(`  [schema:${sf}] ${(e?.message || String(e)).slice(0, 180)}`);
        }
      }
      log.push(`Schema ${sf}: ${okCount} ok, ${failCount} skipped/failed`);
    }

    await safeStep("Restore auth users", async () => {
      const usersFile = zip.file("auth/users.json");
      if (!usersFile) {
        log.push("Auth: no users.json, skipped");
        return;
      }
      const users = JSON.parse(await usersFile.async("string"));
      if (data.mode === "overwrite") {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        for (const u of existing?.users || []) {
          if (u.id === context.userId) continue;
          await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
        }
      }
      for (const u of users) {
        if (u.id === context.userId) continue;
        try {
          const { error } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            phone: u.phone || undefined,
            email_confirm: !!u.email_confirmed_at,
            phone_confirm: !!u.phone_confirmed_at,
            user_metadata: u.user_metadata || {},
            app_metadata: u.app_metadata || {},
          });
          if (error && !error.message.toLowerCase().includes("already")) {
            summary.errors++;
            log.push(`  auth ${u.email}: ${error.message}`);
          } else {
            summary.users++;
          }
        } catch (e: any) {
          summary.errors++;
          log.push(`  auth ${u.email}: ${e?.message || e}`);
        }
      }
      log.push(`Auth restored: ${summary.users} users`);
    });

    const tableNames = Object.keys(manifest.tables || {});
    if (data.mode === "overwrite") {
      for (const t of [...tableNames].reverse()) {
        await safeStep(`Truncate ${t}`, async () => {
          const { error } = await supabaseAdmin.rpc("admin_exec_sql", {
            sql: `TRUNCATE TABLE public.${quoteIdent(t)} RESTART IDENTITY CASCADE;`,
          });
          if (error) throw new Error(error.message);
        });
      }
      log.push(`Truncated ${tableNames.length} tables`);
    }

    for (const t of tableNames) {
      await safeStep(`Restore table ${t}`, async () => {
        const f = zip.file(`data/${t}.jsonl`);
        if (!f) {
          log.push(`Data ${t}: no jsonl, skipped`);
          return;
        }
        const text = await f.async("string");
        if (!text.trim()) {
          log.push(`Data ${t}: empty`);
          return;
        }
        const rows = text
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l));
        const CHUNK = 500;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const q =
            data.mode === "overwrite"
              ? (supabaseAdmin as any).from(t).insert(chunk)
              : (supabaseAdmin as any).from(t).upsert(chunk);
          const { error } = await q;
          if (error) {
            summary.errors++;
            log.push(`  data ${t}: ${error.message.slice(0, 220)}`);
          } else inserted += chunk.length;
        }
        summary.rows += inserted;
        summary.tables++;
        log.push(`Data ${t}: ${inserted}/${rows.length} rows`);
      });
    }

    const bucketsList = manifest.buckets || BUCKETS_TO_BACKUP;
    for (const bucket of bucketsList) {
      await safeStep(`Restore bucket ${bucket}`, async () => {
        const { data: b } = await supabaseAdmin.storage.getBucket(bucket);
        if (!b) {
          await supabaseAdmin.storage.createBucket(bucket, {
            public: bucket === "content" || bucket === "certificate-assets",
          });
          log.push(`Created bucket ${bucket}`);
        }
        const prefix = `storage/${bucket}/`;
        const entries: string[] = [];
        zip.forEach((p) => {
          if (p.startsWith(prefix) && !zip.file(p)?.dir) entries.push(p);
        });
        let uploaded = 0;
        for (const entry of entries) {
          const path = entry.slice(prefix.length);
          const blob = await zip.file(entry)!.async("uint8array");
          const { error } = await supabaseAdmin.storage.from(bucket).upload(path, blob, {
            upsert: data.mode === "overwrite",
          });
          if (error && !error.message.toLowerCase().includes("exists")) {
            summary.errors++;
            log.push(`  storage ${bucket}/${path}: ${error.message}`);
          } else {
            uploaded++;
            summary.files++;
          }
        }
        log.push(`Storage ${bucket}: ${uploaded}/${entries.length} files`);
      });
    }

    log.push(
      `Done. ${summary.tables} tables, ${summary.rows} rows, ${summary.users} users, ${summary.files} files, ${summary.errors} errors`,
    );
    return { ok: true as const, summary, log };
  });
