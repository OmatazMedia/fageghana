import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/api/client";

import { getDeviceInfo } from "@/lib/session-fingerprint";
import { registerSession, heartbeatSession } from "@/lib/session-registry.functions";
import {
  fetchSecuritySettings,
  readIdlePrefs,
  playBeep,
  DEFAULT_SECURITY_SETTINGS,
  type SecuritySettings,
} from "@/lib/security-settings";

/** Fallback idle limit used until the admin settings have loaded. */
export const IDLE_LIMIT_MS = 10 * 60 * 1000;
export const WARN_WINDOW_MS = 10 * 1000; // countdown before auto sign-out
export const ABSOLUTE_LIMIT_MS = 12 * 60 * 60 * 1000; // hard 12h session cap
const HEARTBEAT_MS = 2 * 60 * 1000;

export const LAST_ACTIVITY_KEY = "fage.session.lastActivity";
export const SESSION_START_KEY = "fage.session.startedAt";
export const SESSION_ID_KEY = "fage.session.id";
export const SIGNOUT_BROADCAST_KEY = "fage.session.signout";

function now() {
  return Date.now();
}

function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked */
  }
}

/**
 * Mounted once inside AuthProvider. Enforces idle timeout, absolute session
 * lifetime, and remote revocation across every signed-in page. Cross-tab
 * aware: activity in one tab keeps all tabs alive, sign-out in one tab
 * signs out the rest.
 */
export function SessionGuard() {
  const { user, signOut, roles } = useAuth();
  const register = registerSession;
  const heartbeat = heartbeatSession;

  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const sessionIdRef = useRef<string | null>(null);
  const signingOutRef = useRef(false);
  const lastBeepRef = useRef(0);

  // Admin-defined timings, overridable per user in their own browser.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void fetchSecuritySettings().then((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const isConsoleUser = roles.length > 0 && !roles.every((r) => r === "member");
  const { idleMs, warnMs, beep } = useMemo(() => {
    const prefs = readIdlePrefs();
    const adminMinutes = isConsoleUser
      ? settings.console_idle_minutes
      : settings.member_idle_minutes;
    const minutes = prefs.minutes && prefs.minutes > 0 ? prefs.minutes : adminMinutes;
    return {
      idleMs: Math.max(1, minutes) * 60 * 1000,
      warnMs: Math.max(3, settings.countdown_seconds) * 1000,
      beep: prefs.beep === null ? settings.beep_enabled : prefs.beep,
    };
  }, [settings, isConsoleUser]);

  const bumpActivity = useCallback(() => {
    writeNumber(LAST_ACTIVITY_KEY, now());
  }, []);

  const endSession = useCallback(
    (reason: string, message: string) => {
      if (signingOutRef.current) return;
      signingOutRef.current = true;
      setWarning(false);
      void signOut(reason, message);
    },
    [signOut],
  );

  // Register the device session + seed timers on sign-in.
  useEffect(() => {
    if (!user) {
      sessionIdRef.current = null;
      signingOutRef.current = false;
      setWarning(false);
      return;
    }
    signingOutRef.current = false;
    bumpActivity();
    if (!readNumber(SESSION_START_KEY)) writeNumber(SESSION_START_KEY, now());

    const info = getDeviceInfo();
    let cancelled = false;
    register({
      data: {
        fingerprint: info.fingerprint,
        deviceLabel: info.deviceLabel,
        browser: info.browser,
        os: info.os,
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    })

      .then((r: any) => {
        if (cancelled || !r?.sessionId) return;
        sessionIdRef.current = r.sessionId;
        try {
          localStorage.setItem(SESSION_ID_KEY, r.sessionId);
        } catch {
          /* noop */
        }
      })
      .catch(() => {
        /* registry is best-effort; idle rules still apply */
      });

    return () => {
      cancelled = true;
    };
  }, [user, register, bumpActivity]);

  // Activity listeners (throttled to one write per 5s).
  useEffect(() => {
    if (!user) return;
    let last = 0;
    const onActivity = () => {
      const t = now();
      if (t - last < 5000) return;
      last = t;
      bumpActivity();
      setWarning((w) => {
        if (w) return w; // countdown modal requires an explicit choice
        return w;
      });
    };
    const events = ["mousemove", "mousedown", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === "visible") onActivity();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, bumpActivity]);

  // Cross-tab sign-out broadcast.
  useEffect(() => {
    if (!user) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === SIGNOUT_BROADCAST_KEY && e.newValue) {
        endSession("cross_tab", "You were signed out in another tab.");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user, endSession]);

  // Idle + absolute lifetime ticker.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      if (signingOutRef.current) return;

      const startedAt = readNumber(SESSION_START_KEY);
      if (startedAt && now() - startedAt > ABSOLUTE_LIMIT_MS) {
        endSession("absolute_expiry", "Your session has expired, please sign in again.");
        return;
      }

      const last = readNumber(LAST_ACTIVITY_KEY) ?? now();
      const idleFor = now() - last;

      if (idleFor >= idleMs + warnMs) {
        endSession("idle_timeout", "You were signed out due to inactivity.");
        return;
      }
      if (idleFor >= idleMs) {
        setWarning(true);
        const left = Math.max(0, Math.ceil((idleMs + warnMs - idleFor) / 1000));
        setSecondsLeft(left);
        // One beep per second of the countdown.
        if (beep && now() - lastBeepRef.current > 800) {
          lastBeepRef.current = now();
          playBeep();
        }
      } else {
        setWarning(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [user, endSession, idleMs, warnMs, beep]);

  // Heartbeat: refresh last_seen_at and honour remote revocation / anomalies.
  useEffect(() => {
    if (!user) return;
    const run = () => {
      const sid = sessionIdRef.current;
      if (!sid || signingOutRef.current) return;
      heartbeat({ data: { sessionId: sid, fingerprint: getDeviceInfo().fingerprint } })
        .then((r: any) => {
          if (r && r.valid === false) {
            const msg =
              r.reason === "fingerprint_changed" || r.reason === "network_changed"
                ? "We noticed unusual activity on your session. Please sign in again."
                : "This device was signed out remotely.";
            endSession(r.reason ?? "revoked", msg);
          }
        })
        .catch(() => {
          /* transient network errors shouldn't sign the user out */
        });
    };
    const id = window.setInterval(run, HEARTBEAT_MS);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, heartbeat, endSession]);

  if (!user || !warning) return null;

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-foreground">Are you still there?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          For your security you'll be signed out in{" "}
          <span className="font-semibold text-destructive">
            {mm}:{ss}
          </span>{" "}
          because of inactivity.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => endSession("manual", "You have been successfully signed out")}
            className="rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Sign out now
          </button>
          <button
            onClick={() => {
              bumpActivity();
              setWarning(false);
              void supabase.auth.refreshSession().catch(() => {});
            }}

            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
