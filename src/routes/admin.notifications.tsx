import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/api/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Admin" }] }),
  component: NotifPage,
});

function NotifPage() {
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  async function load() {
    const [n, m] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("member_profiles").select("user_id,contact_name,company_name,member_id"),
    ]);
    setItems(n.data ?? []);
    setMembers(m.data ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const target = String(fd.get("user_id") ?? "");
    const payload: any = { title: String(fd.get("title")), body: String(fd.get("body")) };
    if (target) payload.user_id = target;
    const { error } = await supabase.from("notifications").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Sent");
    (e.currentTarget as HTMLFormElement).reset();
    await load();
  }

  return (
    <AdminShell
      title="Notifications"
      description="Send broadcasts to all members or message a specific member."
    >
      <form
        onSubmit={send}
        className="mb-6 grid grid-cols-1 gap-3 rounded-2xl bg-card p-6 shadow-sm md:grid-cols-2"
      >
        <FormField label="Recipient">
          <select name="user_id" className={inputCls}>
            <option value="">All members (broadcast)</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.member_id ?? "—"} — {m.contact_name || m.company_name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Title">
          <input name="title" required className={inputCls} />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Body">
            <textarea name="body" rows={3} required className={inputCls} />
          </FormField>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Send
          </button>
        </div>
      </form>
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="font-medium">
              {n.title}{" "}
              <span className="ml-2 text-xs text-muted-foreground">
                {n.user_id ? "Direct" : "Broadcast"}
              </span>
            </div>
            <p className="text-muted-foreground">{n.body}</p>
            <div className="text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
