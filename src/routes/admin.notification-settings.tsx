import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, Plus, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/notification-settings")({
  head: () => ({ meta: [{ title: "Notification Settings — Admin" }] }),
  component: NotificationSettingsPage,
});

function NotificationSettingsPage() {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_notification_settings")
        .select("chat_message_recipients")
        .eq("id", 1)
        .maybeSingle();
      setRecipients(((data?.chat_message_recipients as string[]) ?? []).filter(Boolean));
      setLoading(false);
    })();
  }, []);

  function add() {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (recipients.includes(v)) {
      toast.info("Already in the list");
      return;
    }
    setRecipients((r) => [...r, v]);
    setInput("");
  }

  function remove(email: string) {
    setRecipients((r) => r.filter((e) => e !== email));
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("admin_notification_settings")
      .upsert({ id: 1, chat_message_recipients: recipients, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Notification settings saved");
  }

  return (
    <AdminShell
      title="Notification Settings"
      description="Choose who receives an email when someone submits a message through the website chatbot's 'Leave a message' form."
    >
      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Chatbot "Leave a message" recipients</h3>
              <p className="text-xs text-muted-foreground">
                Every listed email receives a branded notification with the sender's name, contact
                details and message.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {recipients.length === 0 && (
                  <p className="text-xs italic text-muted-foreground">
                    No recipients configured yet — chatbot messages will still show in the admin
                    dashboard, but no email will be sent.
                  </p>
                )}
                {recipients.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-2 rounded-full bg-primary/10 py-1 pl-3 pr-1 text-xs font-medium text-primary"
                  >
                    {e}
                    <button
                      onClick={() => remove(e)}
                      className="rounded-full p-0.5 hover:bg-primary/20"
                      aria-label={`Remove ${e}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  type="email"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                  placeholder="name@example.com"
                  className={inputCls}
                />
                <button
                  onClick={add}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-4 py-2 text-sm font-semibold hover:bg-secondary/80"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
