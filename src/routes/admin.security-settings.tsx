import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  DEFAULT_SECURITY_SETTINGS,
  fetchSecuritySettings,
  playBeep,
  type SecuritySettings,
} from "@/lib/security-settings";

export const Route = createFileRoute("/admin/security-settings")({
  head: () => ({
    meta: [
      { title: "Session & Auto Sign-out — FAGE Admin" },
      {
        name: "description",
        content:
          "Set how long members and staff can stay idle before FAGE signs them out automatically.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SecuritySettingsPage,
});

function SecuritySettingsPage() {
  const [s, setS] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchSecuritySettings().then((v) => {
      setS(v);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    const payload = {
      member_idle_minutes: Math.max(1, s.member_idle_minutes),
      console_idle_minutes: Math.max(1, s.console_idle_minutes),
      countdown_seconds: Math.max(3, s.countdown_seconds),
      beep_enabled: s.beep_enabled,
      singleton: true,
    };
    const { error } = await supabase
      .from("security_settings" as any)
      .upsert(payload as any, { onConflict: "singleton" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Session settings saved");
  }

  return (
    <AdminShell
      title="Session & Auto Sign-out"
      description="Control how long an idle session stays alive before it is terminated."
      action={
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
        </button>
      }
    >
      <div className="max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-5">
        <NumberField
          label="Member idle timeout (minutes)"
          hint="How long a member dashboard can sit unused before the warning appears."
          value={s.member_idle_minutes}
          min={1}
          max={240}
          onChange={(v) => setS({ ...s, member_idle_minutes: v })}
        />
        <NumberField
          label="Staff / admin idle timeout (minutes)"
          hint="Applies to every console role (admin, staff, finance, CEO, developer, coordinator)."
          value={s.console_idle_minutes}
          min={1}
          max={240}
          onChange={(v) => setS({ ...s, console_idle_minutes: v })}
        />
        <NumberField
          label="Countdown before sign-out (seconds)"
          hint="The 'Are you still there?' modal counts down for this long, then terminates the session and clears the cache."
          value={s.countdown_seconds}
          min={3}
          max={120}
          onChange={(v) => setS({ ...s, countdown_seconds: v })}
        />
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={s.beep_enabled}
            onChange={(e) => setS({ ...s, beep_enabled: e.target.checked })}
          />
          <span>
            <span className="font-medium">Beep during the countdown</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Each user can override this from their own Account &amp; Security page.
            </span>
          </span>
        </label>
        <button
          onClick={() => playBeep()}
          className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-accent"
        >
          <Volume2 className="h-3.5 w-3.5" /> Test beep
        </button>
      </div>
    </AdminShell>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
