import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listActivityLog } from "@/lib/activity.functions";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/admin/activity-log")({
  head: () => ({ meta: [{ title: "Activity Log — FAGE Admin" }] }),
  component: ActivityLogPage,
});

function ActivityLogPage() {
  const [filter, setFilter] = useState<string>("");
  const fetcher = useServerFn(listActivityLog);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["activity-log", filter],
    queryFn: () => fetcher({ data: { limit: 200, event_type: filter || null } }),
  });

  const rows = (data ?? []) as any[];

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            Recent sign-ins, sign-outs, and system events with IP and user-agent details.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {["", "login", "logout", "password_reset", "profile_update"].map((e) => (
          <button
            key={e || "all"}
            onClick={() => setFilter(e)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              filter === e
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:bg-muted"
            }`}
          >
            {e || "All"}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          className="ml-auto rounded-full border border-border bg-white px-3 py-1 text-xs font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">User agent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No activity yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {r.event_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-xs">{r.user_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs">{r.ip_address ?? "—"}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[280px]">
                  {r.user_agent ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
