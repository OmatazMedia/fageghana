import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck, Send } from "lucide-react";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { getEmailSettings, saveEmailSettings, sendTestEmail } from "@/lib/email/admin.functions";

export const Route = createFileRoute("/admin/email-settings")({
  head: () => ({ meta: [{ title: "Email Settings — FAGE Admin" }] }),
  component: EmailSettingsPage,
});

const emptySettings = {
  resend_api_key: "",
  resend_from: "",
  resend_enabled: false,
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_from: "",
  smtp_secure: false,
  smtp_enabled: false,
  primary_provider: "resend" as "resend" | "smtp",
};

function EmailSettingsPage() {
  const loadSettings = useServerFn(getEmailSettings);
  const saveSettings = useServerFn(saveEmailSettings);
  const sendTest = useServerFn(sendTestEmail);
  const [form, setForm] = useState(emptySettings);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSettings().then((data) => {
      if (data) setForm({ ...emptySettings, ...(data as any) });
    });
  }, [loadSettings]);

  function update(key: keyof typeof emptySettings, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveSettings({ data: { ...form, smtp_port: Number(form.smtp_port || 587) } });
      toast.success("Email settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save email settings");
    } finally {
      setBusy(false);
    }
  }

  async function test(provider: "resend" | "smtp" | "auto") {
    if (!testTo) return toast.error("Enter a test recipient email first");
    setBusy(true);
    try {
      const res = await sendTest({ data: { to: testTo, provider } });
      if (res.ok) toast.success(`Email sent via ${res.provider}${res.fallback ? " fallback" : ""}`);
      else toast.error(res.error ?? "Test email failed");
    } catch (e: any) {
      toast.error(e?.message ?? "Test email failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell
      title="Email Settings"
      description="Configure Resend first, SMTP fallback, and test both providers."
    >
      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Resend</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.resend_enabled}
                  onChange={(e) => update("resend_enabled", e.target.checked)}
                />{" "}
                Enable Resend
              </label>
              <FormField label="API key" hint="Leave masked/blank to keep the existing saved key.">
                <input
                  type="password"
                  className={inputCls}
                  value={form.resend_api_key ?? ""}
                  onChange={(e) => update("resend_api_key", e.target.value)}
                />
              </FormField>
              <FormField label="From address">
                <input
                  className={inputCls}
                  placeholder="FAGE Ghana <membership@fageghana.org>"
                  value={form.resend_from ?? ""}
                  onChange={(e) => update("resend_from", e.target.value)}
                />
              </FormField>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <h2 className="font-bold">SMTP fallback</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.smtp_enabled}
                  onChange={(e) => update("smtp_enabled", e.target.checked)}
                />{" "}
                Enable SMTP
              </label>
              <FormField label="SMTP host">
                <input
                  className={inputCls}
                  value={form.smtp_host ?? ""}
                  onChange={(e) => update("smtp_host", e.target.value)}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Port">
                  <input
                    type="number"
                    className={inputCls}
                    value={form.smtp_port ?? 587}
                    onChange={(e) => update("smtp_port", Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Security">
                  <select
                    className={inputCls}
                    value={form.smtp_secure ? "ssl" : "starttls"}
                    onChange={(e) => update("smtp_secure", e.target.value === "ssl")}
                  >
                    <option value="starttls">STARTTLS / 587</option>
                    <option value="ssl">SSL / 465</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Username">
                <input
                  className={inputCls}
                  value={form.smtp_user ?? ""}
                  onChange={(e) => update("smtp_user", e.target.value)}
                />
              </FormField>
              <FormField
                label="Password"
                hint="Leave masked/blank to keep the existing saved password."
              >
                <input
                  type="password"
                  className={inputCls}
                  value={form.smtp_password ?? ""}
                  onChange={(e) => update("smtp_password", e.target.value)}
                />
              </FormField>
              <FormField label="From address">
                <input
                  className={inputCls}
                  value={form.smtp_from ?? ""}
                  onChange={(e) => update("smtp_from", e.target.value)}
                />
              </FormField>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <FormField label="Primary provider">
              <select
                className={inputCls}
                value={form.primary_provider}
                onChange={(e) => update("primary_provider", e.target.value)}
              >
                <option value="resend">Resend first</option>
                <option value="smtp">SMTP first</option>
              </select>
            </FormField>
            <FormField label="Test recipient">
              <input
                type="email"
                className={inputCls}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
              />
            </FormField>
            <button
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              Save settings
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => test("auto")}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
            >
              Test auto failover
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => test("resend")}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
            >
              Test Resend only
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => test("smtp")}
              className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent disabled:opacity-60"
            >
              Test SMTP only
            </button>
          </div>
        </section>
      </form>
    </AdminShell>
  );
}
