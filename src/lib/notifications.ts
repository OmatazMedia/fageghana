import { supabase } from "@/integrations/supabase/client";

export type FeedItem = {
  id: string;
  type:
    | "notification"
    | "payment"
    | "ticket"
    | "application"
    | "contact"
    | "directory"
    | "member"
    | "activity"
    | "subscription";
  title: string;
  subtitle?: string;
  href: string;
  createdAt: string;
  sourceTable: string;
  sourceId: string;
};

const key = (t: string, id: string) => `${t}:${id}`;

export async function fetchMemberFeed(userId: string): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const [notif, pays, tickets, profile] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,title,body,created_at,user_id")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payment_submissions")
      .select("id,status,amount,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("support_tickets")
      .select("id,subject,status,created_at,user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("member_profiles")
      .select("subscription_expiry,tier")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  (notif.data ?? []).forEach((n: any) =>
    items.push({
      id: key("notifications", n.id),
      type: "notification",
      title: n.title,
      subtitle: n.body?.slice(0, 120),
      href: "/dashboard?tab=notifications",
      createdAt: n.created_at,
      sourceTable: "notifications",
      sourceId: n.id,
    }),
  );

  (pays.data ?? []).forEach((p: any) =>
    items.push({
      id: key("payment_submissions", p.id),
      type: "payment",
      title: `Payment ${p.status}`,
      subtitle: p.amount ? `Amount: ${p.amount}` : undefined,
      href: "/dashboard?tab=invoices",
      createdAt: p.created_at,
      sourceTable: "payment_submissions",
      sourceId: p.id,
    }),
  );

  (tickets.data ?? []).forEach((t: any) =>
    items.push({
      id: key("support_tickets", t.id),
      type: "ticket",
      title: `Ticket: ${t.subject}`,
      subtitle: `Status: ${t.status}`,
      href: "/dashboard?tab=support",
      createdAt: t.created_at,
      sourceTable: "support_tickets",
      sourceId: t.id,
    }),
  );

  if (profile.data?.subscription_expiry) {
    const exp = new Date(profile.data.subscription_expiry);
    const days = Math.round((exp.getTime() - Date.now()) / 86_400_000);
    if (days <= 30) {
      items.push({
        id: key("subscription", profile.data.subscription_expiry),
        type: "subscription",
        title:
          days < 0
            ? "Subscription expired"
            : days === 0
              ? "Subscription expires today"
              : `Subscription expires in ${days} days`,
        subtitle: `Tier: ${profile.data.tier ?? "—"}`,
        href: "/dashboard?tab=subscription",
        createdAt: exp.toISOString(),
        sourceTable: "subscription",
        sourceId: profile.data.subscription_expiry,
      });
    }
  }

  return items
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 50);
}

export async function fetchAdminFeed(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  const [apps, pays, contacts, tickets, dir, members] = await Promise.all([
    supabase
      .from("membership_applications")
      .select("id,full_name,tier,status,created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("payment_submissions")
      .select("id,amount,status,created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("contact_messages")
      .select("id,name,subject,created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("support_tickets")
      .select("id,subject,status,created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("directory_entries")
      .select("id,company_name,status,created_at")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("member_profiles")
      .select("user_id,contact_name,company_name,created_at,member_id")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  (apps.data ?? []).forEach((a: any) =>
    items.push({
      id: key("membership_applications", a.id),
      type: "application",
      title: `Application: ${a.full_name ?? "—"}`,
      subtitle: `${a.tier ?? ""} · ${a.status ?? ""}`,
      href: "/admin/applications",
      createdAt: a.created_at,
      sourceTable: "membership_applications",
      sourceId: a.id,
    }),
  );

  (pays.data ?? []).forEach((p: any) =>
    items.push({
      id: key("payment_submissions", p.id),
      type: "payment",
      title: `Payment ${p.status}`,
      subtitle: p.amount ? `Amount: ${p.amount}` : undefined,
      href: "/admin/payments",
      createdAt: p.created_at,
      sourceTable: "payment_submissions",
      sourceId: p.id,
    }),
  );

  (contacts.data ?? []).forEach((c: any) => {
    const isChat = c.source === "chat_widget";
    items.push({
      id: key("contact_messages", c.id),
      type: "contact",
      title: isChat
        ? `Chatbot message from ${c.name ?? "—"}`
        : `Contact: ${c.subject ?? "New message"}`,
      subtitle: isChat ? (c.message ? String(c.message).slice(0, 80) : "") : `From ${c.name ?? "—"}`,
      href: isChat
        ? `/admin/tickets?tab=chat#msg-${c.id}`
        : "/admin/tickets?tab=tickets",
      createdAt: c.created_at,
      sourceTable: "contact_messages",
      sourceId: c.id,
    });
  });

  (tickets.data ?? []).forEach((t: any) =>
    items.push({
      id: key("support_tickets", t.id),
      type: "ticket",
      title: `Ticket: ${t.subject}`,
      subtitle: `Status: ${t.status}`,
      href: "/admin/tickets",
      createdAt: t.created_at,
      sourceTable: "support_tickets",
      sourceId: t.id,
    }),
  );

  (dir.data ?? []).forEach((d: any) =>
    items.push({
      id: key("directory_entries", d.id),
      type: "directory",
      title: `Directory: ${d.company_name ?? "—"}`,
      subtitle: `Status: ${d.status}`,
      href: "/admin/directory-entries",
      createdAt: d.created_at,
      sourceTable: "directory_entries",
      sourceId: d.id,
    }),
  );

  (members.data ?? []).forEach((m: any) =>
    items.push({
      id: key("member_profiles", m.user_id),
      type: "member",
      title: `New member: ${m.contact_name ?? m.company_name ?? "—"}`,
      subtitle: m.member_id ?? undefined,
      href: "/admin/members",
      createdAt: m.created_at,
      sourceTable: "member_profiles",
      sourceId: m.user_id,
    }),
  );

  return items
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 60);
}

export async function fetchReads(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("notification_reads")
    .select("source_table,source_id")
    .eq("user_id", userId);
  const set = new Set<string>();
  (data ?? []).forEach((r: any) => set.add(`${r.source_table}:${r.source_id}`));
  return set;
}

export async function markRead(userId: string, items: FeedItem[]) {
  if (!items.length) return;
  await supabase.from("notification_reads").upsert(
    items.map((i) => ({
      user_id: userId,
      source_table: i.sourceTable,
      source_id: i.sourceId,
    })),
    { onConflict: "user_id,source_table,source_id" },
  );
}
