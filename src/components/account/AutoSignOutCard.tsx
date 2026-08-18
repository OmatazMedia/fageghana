import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Timer, Volume2 } from "lucide-react";
import {
  DEFAULT_SECURITY_SETTINGS,
  fetchSecuritySettings,
  playBeep,
  readIdlePrefs,
  writeIdlePrefs,
  type SecuritySettings,
} from "@/lib/security-settings";

/**
 * Per-user override of the admin's idle timeout. Stored in the browser, so it
 * never weakens anyone else's session. Leaving the field on "Use default"
 * follows whatever the admin has configured.
 */
export function AutoSignOutCard() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [minutes, setMinutes] = useState<string>("");
  const [beep, setBeep] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchSecuritySettings().then(setSettings);
    const p = readIdlePrefs();
    setMinutes(p.minutes ? String(p.minutes) : "");
    setBeep(p.beep);
  }, []);

  function save() {
    const m = minutes.trim() === "" ? null : Math.max(1, Number(minutes));
    if (m !== null && Number.isNaN(m)) return toast.error("Enter a number of minutes");
    writeIdlePrefs({ minutes: m, beep });
    toast.success("Auto sign-out preference saved");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Timer className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">Auto sign-out</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        After a period of inactivity you'll see a countdown, then be signed out and your cached data
        cleared. Default set by the administrator: {settings.member_idle_minutes} minutes with a{" "}
        {settings.countdown_seconds}-second countdown.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium">Sign me out after (minutes)</label>
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Use default"
            inputMode="numeric"
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={beep === null ? settings.beep_enabled : beep}
            onChange={(e) => setBeep(e.target.checked)}
          />
          Beep during the countdown
        </label>
        <button
          onClick={() => playBeep()}
          className="mb-1 flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent"
        >
          <Volume2 className="h-3.5 w-3.5" /> Test
        </button>
        <button
          onClick={save}
          className="mb-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Save preference
        </button>
      </div>
    </div>
  );
}
