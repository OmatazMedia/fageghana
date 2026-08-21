import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CreditCard,
  MessageCircle,
  UserPlus,
  Mail,
  Building2,
  FileText,
  ShieldAlert,
  BellRing,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  fetchAdminFeed,
  fetchMemberFeed,
  fetchReads,
  markRead,
  type FeedItem,
} from "@/lib/notifications";
import { supabase } from "@/integrations/api/client";

const ICONS: Record<FeedItem["type"], any> = {
  notification: BellRing,
  payment: CreditCard,
  ticket: MessageCircle,
  application: FileText,
  contact: Mail,
  directory: Building2,
  member: UserPlus,
  activity: ShieldAlert,
  subscription: ShieldAlert,
};

function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({ scope }: { scope: "admin" | "member" }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const feedKey = ["notif-feed", scope, user?.id];
  const readsKey = ["notif-reads", user?.id];

  const { data: items = [] } = useQuery({
    queryKey: feedKey,
    enabled: !!user,
    queryFn: () => (scope === "admin" ? fetchAdminFeed() : fetchMemberFeed(user!.id)),
    refetchInterval: 30_000,
  });

  const { data: reads = new Set<string>() } = useQuery({
    queryKey: readsKey,
    enabled: !!user,
    queryFn: () => fetchReads(user!.id),
  });

  const unread = items.filter((i) => !reads.has(`${i.sourceTable}:${i.sourceId}`));

  // Realtime refresh on any relevant source table
  useEffect(() => {
    if (!user) return;
    const tables =
      scope === "admin"
        ? [
            "membership_applications",
            "payment_submissions",
            "contact_messages",
            "support_tickets",
            "directory_entries",
            "member_profiles",
            "ticket_messages",
          ]
        : ["notifications", "payment_submissions", "support_tickets", "ticket_messages"];
    const channel = supabase.channel(`notif-${scope}-${user.id}`);
    tables.forEach((t) =>
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: t },
        () => qc.invalidateQueries({ queryKey: feedKey }),
      ),
    );
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, scope]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleClick(item: FeedItem) {
    if (user && !reads.has(`${item.sourceTable}:${item.sourceId}`)) {
      await markRead(user.id, [item]);
      qc.invalidateQueries({ queryKey: readsKey });
    }
    setOpen(false);
    // navigate supports plain string href
    navigate({ to: item.href as any });
  }

  async function markAllRead() {
    if (!user) return;
    await markRead(user.id, unread);
    qc.invalidateQueries({ queryKey: readsKey });
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background hover:bg-accent transition"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive px-1 text-[10px] font-bold text-white flex items-center justify-center">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">Notifications</div>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                You're all caught up.
              </div>
            ) : (
              items.map((item) => {
                const Icon = ICONS[item.type] ?? Bell;
                const isUnread = !reads.has(`${item.sourceTable}:${item.sourceId}`);
                return (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item)}
                    className={`flex w-full gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-accent/60 transition ${
                      isUnread ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        isUnread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-tight text-foreground truncate">
                          {item.title}
                        </div>
                        {isUnread && (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </div>
                      )}
                      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {timeAgo(item.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
