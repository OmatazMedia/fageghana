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
END $$;`
    )
    .join("\n\n");
}

function buildTablesSQL(
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; notnull: boolean; default: string | null }>;
    pk: string[] | null;
  }>
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
  }>
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

    const zip = new JSZip();
    const log: string[] = [];
    const counts: Record<string, number> = {};

    // Schema
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
    zip.file(
      "schema/functions.sql",
      fns.map((f: any) => f.definition + ";").join("\n\n")
    );
    zip.file(
      "schema/sequences.sql",
      sequences.map((s: any) => `CREATE SEQUENCE IF NOT EXISTS public.${quoteIdent(s.name)};`).join("\n")
    );
    log.push(`Schema: ${tables.length} tables, ${enums.length} enums, ${fns.length} functions, ${policies.length} policies`);

    // Data
    for (const t of tables) {
      const tableName = t.name as string;
      // skip noisy/system-ish? None to skip in public schema for this app.
      let from = 0;
      const lines: string[] = [];
      while (true) {
        const { data, error } = await (supabaseAdmin as any)
          .from(tableName)
          .select("*")
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`dump ${tableName}: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const row of data) lines.push(JSON.stringify(row));
        if (data.length < PAGE) break;
        from += PAGE;
      }
      zip.file(`data/${tableName}.jsonl`, lines.join("\n"));
      counts[tableName] = lines.length;
      log.push(`Data: ${tableName} → ${lines.length} rows`);
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
        }))
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
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
    const filename = `backup-${manifest.created_at.replace(/[:.]/g, "-")}.zip`;
    const upload = await supabaseAdmin.storage.from("backups").upload(filename, blob, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upload.error) throw new Error("upload: " + upload.error.message);

    const signed = await supabaseAdmin.storage.from("backups").createSignedUrl(filename, 60 * 60);

    return {
      filename,
      path: filename,
      url: signed.data?.signedUrl || null,
      manifest,
      log,
      sizeBytes: blob.byteLength,
    };
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
      })
    );
    return { backups: results };
  });

export const parseBackupManifest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const dl = await supabaseAdmin.storage.from("backups").download(data.path);
    if (dl.error) throw new Error(dl.error.message);
    const buf = await dl.data.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const mf = zip.file("manifest.json");
    if (!mf) throw new Error("Invalid backup: manifest.json missing");
    const manifest = JSON.parse(await mf.async("string"));
    return { manifest };
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; mode: "merge" | "overwrite" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const log: string[] = [];
    const summary = { tables: 0, rows: 0, files: 0, users: 0, errors: 0 };

    const dl = await supabaseAdmin.storage.from("backups").download(data.path);
    if (dl.error) throw new Error(dl.error.message);
    const zip = await JSZip.loadAsync(await dl.data.arrayBuffer());

    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    log.push(`Restoring backup from ${manifest.created_at} (mode: ${data.mode})`);

    // 1. Schema preflight: enums, sequences, tables, functions, policies — only create if missing
    const schemaFiles = ["schema/enums.sql", "schema/sequences.sql", "schema/tables.sql", "schema/functions.sql", "schema/policies.sql"];
    for (const sf of schemaFiles) {
      const f = zip.file(sf);
      if (!f) continue;
      const sql = await f.async("string");
      if (!sql.trim()) continue;
      const stmts = sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        try {
          const { error } = await supabaseAdmin.rpc("admin_exec_sql", { sql: stmt + ";" });
          if (error) {
            // Many statements are idempotent / may fail on re-run; only log
            log.push(`[schema] ${sf}: ${error.message.slice(0, 200)}`);
          }
        } catch (e: any) {
          log.push(`[schema] ${sf}: ${e.message?.slice(0, 200)}`);
        }
      }
      log.push(`Schema applied: ${sf}`);
    }

    // 2. Auth users
    const usersFile = zip.file("auth/users.json");
    if (usersFile) {
      const users = JSON.parse(await usersFile.async("string"));
      if (data.mode === "overwrite") {
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of existing?.users || []) {
          if (u.id === context.userId) continue; // preserve current admin
          await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
        }
      }
      for (const u of users) {
        if (u.id === context.userId) continue;
        try {
          // Try creating with original id
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
            log.push(`auth ${u.email}: ${error.message}`);
          } else {
            summary.users++;
          }
        } catch (e: any) {
          summary.errors++;
          log.push(`auth ${u.email}: ${e.message}`);
        }
      }
      log.push(`Auth restored: ${summary.users} users`);
    }

    // 3. Data — preserve table order from manifest (insertion order)
    const tableNames = Object.keys(manifest.tables || {});
    if (data.mode === "overwrite") {
      // truncate in reverse order with CASCADE
      for (const t of [...tableNames].reverse()) {
        await supabaseAdmin.rpc("admin_exec_sql", {
          sql: `TRUNCATE TABLE public.${quoteIdent(t)} RESTART IDENTITY CASCADE;`,
        });
      }
      log.push(`Truncated ${tableNames.length} tables`);
    }

    for (const t of tableNames) {
      const f = zip.file(`data/${t}.jsonl`);
      if (!f) continue;
      const text = await f.async("string");
      if (!text.trim()) continue;
      const rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
      // chunk
      const CHUNK = 500;
      let inserted = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const q = data.mode === "overwrite"
          ? (supabaseAdmin as any).from(t).insert(chunk)
          : (supabaseAdmin as any).from(t).upsert(chunk);
        const { error } = await q;
        if (error) {
          summary.errors++;
          log.push(`data ${t}: ${error.message.slice(0, 200)}`);
        } else {
          inserted += chunk.length;
        }
      }
      summary.rows += inserted;
      summary.tables++;
      log.push(`Data: ${t} ← ${inserted}/${rows.length} rows`);
    }

    // 4. Storage
    const bucketsList = manifest.buckets || BUCKETS_TO_BACKUP;
    for (const bucket of bucketsList) {
      // ensure bucket exists
      const { data: b } = await supabaseAdmin.storage.getBucket(bucket);
      if (!b) {
        await supabaseAdmin.storage.createBucket(bucket, { public: bucket === "content" || bucket === "certificate-assets" });
        log.push(`Created bucket ${bucket}`);
      }
      // walk zip entries under storage/<bucket>/
      const prefix = `storage/${bucket}/`;
      const entries: string[] = [];
      zip.forEach((p) => {
        if (p.startsWith(prefix) && !zip.file(p)?.dir) entries.push(p);
      });
      for (const entry of entries) {
        const path = entry.slice(prefix.length);
        const blob = await zip.file(entry)!.async("uint8array");
        const { error } = await supabaseAdmin.storage.from(bucket).upload(path, blob, {
          upsert: data.mode === "overwrite",
        });
        if (error && !error.message.toLowerCase().includes("exists")) {
          summary.errors++;
          log.push(`storage ${bucket}/${path}: ${error.message}`);
        } else {
          summary.files++;
        }
      }
      log.push(`Storage: ${bucket} ← ${entries.length} files`);
    }

    log.push(`Done. ${summary.tables} tables, ${summary.rows} rows, ${summary.users} users, ${summary.files} files, ${summary.errors} errors`);
    return { summary, log };
  });
