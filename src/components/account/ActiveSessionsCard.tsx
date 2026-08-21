import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MonitorSmartphone, ShieldAlert, LogOut } from "lucide-react";
import {
  listSessions,
  revokeSession,
  revokeOtherSessions,
  type SessionRow,
} from "@/lib/session-registry.functions";
import { getFingerprint } from "@/lib/session-fingerprint";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

/**
 * Lists the devices a user is signed in on, with revoke controls.
 * Pass `userId` to view another user's sessions (admin only, enforced by RLS).
 */
export function ActiveSessionsCard({ userId }: { userId?: string }) {
  const fetchSessions = listSessions;
  const revokeOne = revokeSession;
  const revokeOthers = revokeOtherSessions;

  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const isSelf = !userId;
  const myFp = typeof window !== "undefined" ? getFingerprint() : "";

  const load = useCallback(() => {
    setLoading(true);
    fetchSessions({ data: userId ? { userId } : {} })
      .then((r: any) => setRows(Array.isArray(r) ? r : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [fetchSessions, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = rows.filter((r) => !r.revoked_at);
  const recent = rows.filter((r) => r.revoked_at).slice(0, 5);

  async function handleRevoke(row: SessionRow) {
    setBusy(row.id);
    try {
      await revokeOne({ data: { sessionId: row.id, reason: "revoked_by_user" } });
      toast.success("Device signed out");
      load();
    } catch {
      toast.error("Could not sign out that device");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevokeOthers() {
    setBusy("others");
    try {
      const r: any = await revokeOthers({ data: { keepFingerprint: myFp } });
      toast.success(
        r?.revoked ? `Signed out ${r.revoked} other device(s)` : "No other devices were signed in",
      );
      load();
    } catch {
      toast.error("Could not sign out the other devices");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MonitorSmartphone className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold">Active sessions</h3>
          <p className="text-xs text-muted-foreground">
            {isSelf
              ? "Devices currently signed in to your account. Sign out any you don't recognise."
              : "Devices this user is signed in on. Revoke access if the account may be compromised."}
          </p>
        </div>
        {isSelf && active.length > 1 && (
          <button
            onClick={handleRevokeOthers}
            disabled={busy === "others"}
            className="shrink-0 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-60"
          >
            {busy === "others" ? "Signing out…" : "Sign out all other devices"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active sessions recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {active.map((s) => {
            const isCurrent = isSelf && s.session_fingerprint === myFp;
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-xs">
                <span className="font-medium text-foreground">{s.device_label ?? "Unknown device"}</span>
                {isCurrent && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    This device
                  </span>
                )}
                {s.suspicious && (
                  <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
                    <ShieldAlert className="h-3 w-3" /> Flagged
                  </span>
                )}
                <span className="text-muted-foreground">· {s.ip_address ?? "IP unknown"}</span>
                <span className="text-muted-foreground">· last seen {timeAgo(s.last_seen_at)}</span>
                {!isCurrent && (
                  <button
                    onClick={() => handleRevoke(s)}
                    disabled={busy === s.id}
                    className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <LogOut className="h-3 w-3" /> {busy === s.id ? "…" : "Sign out"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Recently ended sessions ({recent.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {recent.map((s) => (
              <li key={s.id} className="text-xs text-muted-foreground">
                {s.device_label ?? "Unknown device"} · ended {timeAgo(s.revoked_at!)} ·{" "}
                {s.revoked_reason ?? "signed out"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
