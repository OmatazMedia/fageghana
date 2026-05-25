import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import { createMemberAccount } from "@/server/members.functions";

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members — Admin" }] }),
  component: MembersPage,
});

function MembersPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const create = useServerFn(createMemberAccount);

  async function load() {
    const { data } = await supabase
      .from("member_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  }
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mode = String(fd.get("mode")) as "password" | "invite";
    try {
      const res = await create({
        data: {
          email: String(fd.get("email")),
          full_name: String(fd.get("full_name")),
          phone: String(fd.get("phone") ?? ""),
          company_name: String(fd.get("company_name") ?? ""),
          tier: String(fd.get("tier")) as any,
          mode,
          password: mode === "password" ? String(fd.get("password")) : undefined,
        },
      });
      toast.success(`Member created. ID: ${res.memberId}`);
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  return (
    <AdminShell
      title="Members"
      description="Create member accounts and manage their subscriptions."
      action={
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Create member
        </button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Member ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Expires</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-xs">{r.member_id ?? "—"}</td>
                <td className="px-4 py-3">{r.contact_name}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3 capitalize">{r.tier}</td>
                <td className="px-4 py-3 capitalize">{r.status}</td>
                <td className="px-4 py-3">
                  {r.subscription_expiry
                    ? new Date(r.subscription_expiry).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <CreateModal onClose={() => setOpen(false)} onSubmit={submit} />}
    </AdminShell>
  );
}

function CreateModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [mode, setMode] = useState<"password" | "invite">("invite");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg space-y-3 rounded-2xl bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Create member account</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Full name">
            <input name="full_name" required className={inputCls} />
          </FormField>
          <FormField label="Email">
            <input name="email" type="email" required className={inputCls} />
          </FormField>
          <FormField label="Phone">
            <input name="phone" className={inputCls} />
          </FormField>
          <FormField label="Company">
            <input name="company_name" className={inputCls} />
          </FormField>
        </div>
        <FormField label="Membership tier">
          <select name="tier" required className={inputCls} defaultValue="associate">
            <option value="associate">Associate</option>
            <option value="standard">Standard</option>
            <option value="corporate">Corporate</option>
          </select>
        </FormField>
        <div className="rounded-lg bg-muted/40 p-3">
          <p className="mb-2 text-sm font-medium">Account activation</p>
          <div className="flex gap-2">
            <input type="hidden" name="mode" value={mode} />
            <button
              type="button"
              onClick={() => setMode("invite")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${mode === "invite" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              Send set-password link
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium ${mode === "password" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              Set password now
            </button>
          </div>
          {mode === "password" && (
            <div className="mt-3">
              <FormField label="Temporary password">
                <input
                  name="password"
                  type="text"
                  minLength={6}
                  required
                  className={`${inputCls} font-mono`}
                />
              </FormField>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
