import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/run-scheduled-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        const expected =
          process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
        if (!apikey || !expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runBackupCore, computeNextRun, pruneOldBackups } = await import(
          "@/lib/backup-runner.server"
        );

        const { data: schedule } = await supabaseAdmin
          .from("backup_schedules")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!schedule || !schedule.enabled) {
          return Response.json({ skipped: true, reason: "schedule disabled" });
        }

        const now = new Date();
        const due =
          !schedule.next_run_at || new Date(schedule.next_run_at).getTime() <= now.getTime();
        if (!due) {
          return Response.json({
            skipped: true,
            reason: "not due",
            next_run_at: schedule.next_run_at,
          });
        }

        try {
          const res = await runBackupCore("scheduled");
          const pruned = await pruneOldBackups(schedule.retention_days ?? 30);
          const next = computeNextRun(schedule as any, new Date());
          await supabaseAdmin
            .from("backup_schedules")
            .update({
              last_run_at: now.toISOString(),
              last_status: "success",
              last_error: null,
              next_run_at: next.toISOString(),
            })
            .eq("id", schedule.id);
          return Response.json({
            ok: true,
            path: res.path,
            sizeBytes: res.sizeBytes,
            pruned,
            next_run_at: next.toISOString(),
          });
        } catch (e: any) {
          const msg = e?.message || String(e);
          const next = computeNextRun(schedule as any, new Date());
          await supabaseAdmin
            .from("backup_schedules")
            .update({
              last_run_at: now.toISOString(),
              last_status: "error",
              last_error: msg,
              next_run_at: next.toISOString(),
            })
            .eq("id", schedule.id);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
