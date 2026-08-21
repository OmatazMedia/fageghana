import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listActivityLog } from "@/lib/activity.functions";
import { Activity, RefreshCw, Search, X } from "lucide-react";

export const Route = createFileRoute("/admin/activity-log")({
  head: () => ({ meta: [{ title: "Activity Log — FAGE Admin" }] }),
  component: ActivityLogPage,
});

const EVENT_CHIPS = [
  "",
  "sign_in",
  "sign_out",
  "sign_up",
  "sign_in_failed",
  "password_reset_requested",
  "password_changed",
  "profile_update",
];

const ROLE_OPTIONS = [
  "",
  "admin",
  "superadmin",
  "staff",
  "finance",
  "ceo",
  "developer",
  "coordinator",
  "member",
];

function ActivityLogPage() {
  const [eventType, setEventType] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetcher = listActivityLog;
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["activity-log", eventType, role, q, from, to, page, pageSize],
    queryFn: () =>
      fetcher({
        data: {
          page,
          page_size: pageSize,
          event_type: eventType || null,
          role: role || null,
          q: q || null,
          from: from ? new Date(from).toISOString() : null,
          to: to ? new Date(to + "T23:59:59").toISOString() : null,
        },
      }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function resetFilters() {
    setEventType("");
    setRole("");
    setQ("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Activity Log</h1>
          <p className="text-sm text-muted-foreground">
            All user sign-ins, sign-outs, and system events with IP address, device, and timestamps.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {EVENT_CHIPS.map((e) => (
            <button
              key={e || "all-events"}
              onClick={() => {
                setEventType(e);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                eventType === e
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {e || "All events"}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r || "any"} value={r}>
                  {r || "Any role"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs md:col-span-1">
            <span className="mb-1 block font-medium text-muted-foreground">Search user</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Name or email"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pl-8 text-sm"
              />
            </div>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-muted-foreground">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        {(eventType || role || q || from || to) && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <X className="h-3 w-3" /> Reset filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Roles</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Device</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No activity for these filters.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {r.event_type}
                    </span>
                    {r.detail && (
                      <div className="mt-1 text-xs text-muted-foreground truncate max-w-[220px]">
                        {r.detail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="font-medium">{r.full_name || "—"}</div>
                    <div className="text-muted-foreground">{r.email || r.user_id?.slice(0, 8) || "—"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                      {r.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs">{r.ip_address ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[280px]">
                    {r.user_agent ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-input bg-background px-2 py-1 text-sm"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="text-muted-foreground">
            {total === 0
              ? "0 results"
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
