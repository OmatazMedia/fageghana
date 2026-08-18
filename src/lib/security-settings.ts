import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SecuritySettings = {
  id?: string;
  member_idle_minutes: number;
  console_idle_minutes: number;
  countdown_seconds: number;
  beep_enabled: boolean;
};

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  member_idle_minutes: 10,
  console_idle_minutes: 10,
  countdown_seconds: 10,
  beep_enabled: true,
};

/** Per-user browser preferences layered on top of the admin settings. */
export const IDLE_PREF_MINUTES_KEY = "fage.prefs.idleMinutes";
export const IDLE_PREF_BEEP_KEY = "fage.prefs.idleBeep";

export function readIdlePrefs(): { minutes: number | null; beep: boolean | null } {
  if (typeof window === "undefined") return { minutes: null, beep: null };
  try {
    const m = localStorage.getItem(IDLE_PREF_MINUTES_KEY);
    const b = localStorage.getItem(IDLE_PREF_BEEP_KEY);
    return {
      minutes: m ? Number(m) : null,
      beep: b === null ? null : b === "true",
    };
  } catch {
    return { minutes: null, beep: null };
  }
}

export function writeIdlePrefs(patch: { minutes?: number | null; beep?: boolean | null }) {
  if (typeof window === "undefined") return;
  try {
    if (patch.minutes !== undefined) {
      if (patch.minutes === null) localStorage.removeItem(IDLE_PREF_MINUTES_KEY);
      else localStorage.setItem(IDLE_PREF_MINUTES_KEY, String(patch.minutes));
    }
    if (patch.beep !== undefined) {
      if (patch.beep === null) localStorage.removeItem(IDLE_PREF_BEEP_KEY);
      else localStorage.setItem(IDLE_PREF_BEEP_KEY, String(patch.beep));
    }
  } catch {
    /* storage blocked */
  }
}

export async function fetchSecuritySettings(): Promise<SecuritySettings> {
  const { data } = await supabase
    .from("security_settings" as any)
    .select("id, member_idle_minutes, console_idle_minutes, countdown_seconds, beep_enabled")
    .limit(1)
    .maybeSingle();
  if (!data) return DEFAULT_SECURITY_SETTINGS;
  return { ...DEFAULT_SECURITY_SETTINGS, ...(data as any) };
}

export function useSecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchSecuritySettings().then((s) => {
      if (!alive) return;
      setSettings(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { settings, setSettings, loaded };
}

/** Short two-tone beep used by the inactivity countdown. No audio asset needed. */
export function playBeep(volume = 0.12) {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    osc.start(t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.stop(t + 0.2);
    osc.onended = () => {
      try {
        void ctx.close();
      } catch {
        /* noop */
      }
    };
  } catch {
    /* audio blocked */
  }
}
