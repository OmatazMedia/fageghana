import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminShell, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({ meta: [{ title: "Support — Admin" }] }),
  component: TicketsPage,
});

function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*, member_profiles!inner(contact_name,company_name,member_id)")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function open(t: any) {
    setActive(t);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", t.id)
      .order("created_at");
    setMessages(data ?? []);
  }

  async function send() {
    if (!active || !reply.trim() || !user) return;
    await supabase
      .from("ticket_messages")
      .insert({ ticket_id: active.id, sender_id: user.id, body: reply, is_admin: true });
    await supabase
      .from("support_tickets")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", active.id);
    await supabase
      .from("notifications")
      .insert({ user_id: active.user_id, title: "New reply on your ticket", body: active.subject });
    setReply("");
    void open(active);
  }

  async function setStatus(s: string) {
    if (!active) return;
    await supabase
      .from("support_tickets")
      .update({ status: s as any })
      .eq("id", active.id);
    setActive({ ...active, status: s });
    await load();
  }

  return (
    <AdminShell title="Support Tickets" description="Reply to member support tickets.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => open(t)}
              className={`w-full rounded-lg border p-3 text-left text-sm ${active?.id === t.id ? "border-primary bg-primary/5" : "border-border bg-card"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{t.subject}</span>
                <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.member_profiles?.member_id ?? "—"} ·{" "}
                {t.member_profiles?.contact_name || t.member_profiles?.company_name}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(t.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No tickets.</p>}
        </div>
        <div className="lg:col-span-2">
          {!active ? (
            <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground">
              Pick a ticket.
            </div>
          ) : (
            <div className="rounded-2xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{active.subject}</h3>
                  <span className="text-xs capitalize text-muted-foreground">{active.status}</span>
                </div>
                <select
                  value={active.status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg p-3 text-sm ${m.is_admin ? "bg-primary/10" : "bg-accent"}`}
                  >
                    <div className="text-xs font-semibold text-muted-foreground">
                      {m.is_admin ? "You (Admin)" : "Member"} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <textarea
                  className={inputCls}
                  rows={2}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply…"
                />
                <button
                  onClick={send}
                  className="self-end rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
