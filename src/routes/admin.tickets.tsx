import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Send, MessageCircle, Mail, Search, CheckCircle2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { AdminShell, inputCls } from "@/components/admin/AdminShell";

type TabKey = "tickets" | "chat";
type StatusFilter = "open" | "pending" | "resolved" | "closed" | "all";

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({ meta: [{ title: "Support — Admin" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: (s.tab === "chat" ? "chat" : "tickets") as TabKey,
    status: (["open", "pending", "resolved", "closed", "all"].includes(s.status as string)
      ? (s.status as StatusFilter)
      : "open") as StatusFilter,
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const search = useSearch({ from: "/admin/tickets" });
  const navigate = useNavigate();
  const tab = search.tab;
  const statusFilter = search.status;

  function setTab(t: TabKey) {
    navigate({ to: "/admin/tickets", search: { tab: t, status: statusFilter } as any });
  }
  function setStatusFilter(s: StatusFilter) {
    navigate({ to: "/admin/tickets", search: { tab, status: s } as any });
  }

  return (
    <AdminShell
      title="Support"
      description="Reply to member support tickets and messages from the website chatbot."
    >
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-border">
        <TabBtn active={tab === "tickets"} onClick={() => setTab("tickets")} icon={<MessageCircle className="h-4 w-4" />}>
          Support Tickets
        </TabBtn>
        <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={<Mail className="h-4 w-4" />}>
          Chatbot Messages
        </TabBtn>
      </div>

      {tab === "tickets" ? (
        <TicketsTab statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
      ) : (
        <ChatMessagesTab />
      )}
    </AdminShell>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------------- Tickets tab ---------------- */

function TicketsTab({
  statusFilter,
  setStatusFilter,
}: {
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
}) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("support_tickets")
      .select("*, member_profiles!inner(contact_name,company_name,member_id,email)")
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, resolved: 0, closed: 0, all: tickets.length } as Record<StatusFilter, number>;
    tickets.forEach((t) => {
      if (t.status in c) (c as any)[t.status]++;
    });
    return c;
  }, [tickets]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const hay = `${t.subject} ${t.member_profiles?.contact_name ?? ""} ${t.member_profiles?.company_name ?? ""} ${t.member_profiles?.member_id ?? ""} ${t.member_profiles?.email ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, q]);

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
    await supabase.from("ticket_messages").insert({
      ticket_id: active.id,
      sender_id: user.id,
      body: reply,
      is_admin: true,
    });
    await supabase
      .from("support_tickets")
      .update({ status: "pending", updated_at: new Date().toISOString() })
      .eq("id", active.id);
    await supabase.from("notifications").insert({
      user_id: active.user_id,
      title: "New reply on your ticket",
      body: active.subject,
    });
    setReply("");
    void open(active);
    void load();
  }

  async function setStatus(s: string) {
    if (!active) return;
    await supabase.from("support_tickets").update({ status: s as any }).eq("id", active.id);
    setActive({ ...active, status: s });
    await load();
  }

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "open", label: "Open" },
    { key: "pending", label: "Pending" },
    { key: "resolved", label: "Resolved" },
    { key: "closed", label: "Closed" },
    { key: "all", label: "All" },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              statusFilter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {f.label} · {counts[f.key] ?? 0}
          </button>
        ))}
        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search subject or member…"
            className="w-64 rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1 max-h-[calc(100vh-260px)] overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => open(t)}
              className={`w-full rounded-lg border p-3 text-left text-sm ${
                active?.id === t.id ? "border-primary bg-primary/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{t.subject}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t.member_profiles?.member_id ?? "—"} ·{" "}
                {t.member_profiles?.contact_name || t.member_profiles?.company_name}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {new Date(t.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No tickets in this view.
            </p>
          )}
        </div>

        <div className="lg:col-span-2">
          {!active ? (
            <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground">
              Pick a ticket to view the conversation.
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
              <div className="max-h-96 space-y-3 overflow-y-auto">
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
    </>
  );
}

/* ---------------- Chatbot messages tab ---------------- */

type ChatMsg = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  source: string;
  created_at: string;
  handled_at: string | null;
};

function ChatMessagesTab() {
  const [rows, setRows] = useState<ChatMsg[]>([]);
  const [q, setQ] = useState("");
  const [showHandled, setShowHandled] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_messages")
      .select("id,name,email,phone,subject,message,source,created_at,handled_at")
      .eq("source", "chat_widget")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows(((data as any) ?? []) as ChatMsg[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Auto-scroll to hash target when navigating from notification bell
  useEffect(() => {
    if (loading) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2400);
    }
  }, [loading, rows.length]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!showHandled && r.handled_at) return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const hay = `${r.name} ${r.email} ${r.phone ?? ""} ${r.message}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, showHandled]);

  async function markHandled(id: string, handled: boolean) {
    const { error } = await supabase
      .from("contact_messages")
      .update({ handled_at: handled ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(handled ? "Marked as handled" : "Reopened");
    void load();
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={showHandled}
            onChange={(e) => setShowHandled(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          Show handled
        </label>
        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone or message…"
            className="w-72 rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No chatbot messages in this view.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              id={`msg-${r.id}`}
              className="rounded-xl border border-border bg-card p-4 shadow-sm transition"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{r.name}</div>
                    {r.handled_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Handled
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <a href={`mailto:${r.email}`} className="text-primary hover:underline">
                      {r.email}
                    </a>
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="hover:underline">
                        {r.phone}
                      </a>
                    )}
                    <span>{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${r.email}?subject=Re:%20Your%20message%20to%20FAGE`}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                  >
                    <ExternalLink className="h-3 w-3" /> Reply by email
                  </a>
                  <button
                    onClick={() => markHandled(r.id, !r.handled_at)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      r.handled_at
                        ? "border border-border bg-background hover:bg-muted"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {r.handled_at ? "Reopen" : "Mark handled"}
                  </button>
                </div>
              </div>
              <div className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">
                {r.message}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
