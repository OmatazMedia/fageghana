import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldOff, ShieldCheck, RefreshCw, Ban } from "lucide-react";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  listIpBans,
  listLoginAttempts,
  unbanIp,
  banIpManually,
} from "@/lib/login-security.functions";

export const Route = createFileRoute("/admin/login-security")({
  head: () => ({ meta: [{ title: "Login Security — FAGE Admin" }] }),
  component: LoginSecurityPage,
});

const OUTCOME_LABELS: Record<string, string> = {
  email_ok: "Email accepted",
  email_unknown: "Unknown email",
  bad_password: "Wrong password",
  success: "Signed in",
  blocked_input: "Blocked input",
  reset_unknown: "Reset — unknown email",
  reset_requested: "Reset requested",
};

function badgeCls(outcome: string) {
  if (outcome === "success" || outcome === "email_ok") return "bg-emerald-100 text-emerald-700";
  if (outcome === "reset_requested") return "bg-blue-100 text-blue-700";
  if (outcome === "blocked_input") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function when(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function LoginSecurityPage() {
  const bansFn = listIpBans;
  const attemptsFn = listLoginAttempts;
  const unbanFn = unbanIp;
  const banFn = banIpManually;

  const [bans, setBans] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterIp, setFilterIp] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterOutcome, setFilterOutcome] = useState("");
  const [loading, setLoading] = useState(true);

  const [newIp, setNewIp] = useState("");
  const [newHours, setNewHours] = useState("24");
  const [newReason, setNewReason] = useState("");

  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a]: any[] = await Promise.all([
        bansFn(),
        attemptsFn({
          data: {
            page,
            pageSize,
            ip: filterIp || undefined,
            email: filterEmail || undefined,
            outcome: filterOutcome || undefined,
          },
        }),
      ]);
      setBans(b ?? []);
      setAttempts(a?.rows ?? []);
      setTotal(a?.total ?? 0);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load login security data");
    } finally {
      setLoading(false);
    }
  }, [bansFn, attemptsFn, page, filterIp, filterEmail, filterOutcome]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnban(id: string, ip: string) {
    if (!confirm(`Unblock ${ip}? Their attempt history will be cleared.`)) return;
    try {
      await unbanFn({ data: { id } });
      toast.success(`${ip} unblocked`);
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not unblock that address");
    }
  }

  async function handleBan(e: React.FormEvent) {
    e.preventDefault();
    try {
      await banFn({
        data: { ip: newIp.trim(), hours: Number(newHours) || 24, reason: newReason || undefined },
      });
      toast.success("Address blocked");
      setNewIp("");
      setNewReason("");
      void load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not block that address");
    }
  }

  const activeBans = bans.filter(
    (b) => b.banned_at && !b.unbanned_at && (!b.expires_at || new Date(b.expires_at) > new Date()),
  );
  const watchlist = bans.filter((b) => !activeBans.includes(b) && (b.warning_count ?? 0) > 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AdminShell
      title="Login Security"
      description="Blocked networks, warnings and every admin sign-in attempt."
      action={
        <button
          onClick={() => void load()}
          className="flex items-center gap-2 rounded-xl border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      }
    >
      {/* Active bans */}
      <section className="mb-8 rounded-2xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ShieldOff className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">
            Blocked networks ({activeBans.length})
          </h2>
        </header>
        {activeBans.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No networks are currently blocked.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">IP / subnet</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Blocked</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeBans.map((b) => (
                  <tr key={b.id} className="border-t border-border">
                    <td className="px-5 py-3 font-mono text-xs">
                      {b.ip}
                      <span className="block text-muted-foreground">{b.subnet}</span>
                    </td>
                    <td className="px-5 py-3 max-w-xs">{b.reason ?? "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{when(b.banned_at)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{when(b.expires_at)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => void handleUnban(b.id, b.ip)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Watchlist */}
      {watchlist.length > 0 && (
        <section className="mb-8 rounded-2xl border border-border bg-card">
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">
              Warned networks ({watchlist.length})
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Three warnings blocks the address and its subnet automatically.
            </p>
          </header>
          <div className="divide-y divide-border">
            {watchlist.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="font-mono text-xs">{b.ip}</span>
                <span className="text-muted-foreground">
                  {b.warning_count} warning{b.warning_count === 1 ? "" : "s"} · last{" "}
                  {when(b.updated_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Manual block */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Ban className="h-4 w-4" />
          Block an address manually
        </h2>
        <form onSubmit={handleBan} className="grid gap-4 sm:grid-cols-[1fr_130px_1fr_auto] sm:items-end">
          <FormField label="IP address">
            <input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              required
              placeholder="102.176.0.15"
              className={inputCls}
            />
          </FormField>
          <FormField label="Hours">
            <input
              type="number"
              min={1}
              max={8760}
              value={newHours}
              onChange={(e) => setNewHours(e.target.value)}
              className={inputCls}
            />
          </FormField>
          <FormField label="Reason">
            <input
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Repeated probing"
              className={inputCls}
            />
          </FormField>
          <button
            type="submit"
            className="rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
          >
            Block
          </button>
        </form>
      </section>

      {/* Attempts */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Sign-in attempts</h2>
        </header>
        <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-3">
          <input
            value={filterIp}
            onChange={(e) => {
              setPage(1);
              setFilterIp(e.target.value);
            }}
            placeholder="Filter by IP"
            className={inputCls}
          />
          <input
            value={filterEmail}
            onChange={(e) => {
              setPage(1);
              setFilterEmail(e.target.value);
            }}
            placeholder="Filter by email"
            className={inputCls}
          />
          <select
            value={filterOutcome}
            onChange={(e) => {
              setPage(1);
              setFilterOutcome(e.target.value);
            }}
            className={inputCls}
          >
            <option value="">All outcomes</option>
            {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">When</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Email tried</th>
                <th className="px-5 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    {loading ? "Loading…" : "No attempts recorded."}
                  </td>
                </tr>
              ) : (
                attempts.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-5 py-3 whitespace-nowrap">{when(a.created_at)}</td>
                    <td className="px-5 py-3 font-mono text-xs">{a.ip}</td>
                    <td className="px-5 py-3">{a.email_tried ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeCls(a.outcome)}`}>
                        {OUTCOME_LABELS[a.outcome] ?? a.outcome}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {page} of {pages} · {total} attempts
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-input px-3 py-1.5 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-input px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
