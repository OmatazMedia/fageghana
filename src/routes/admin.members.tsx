import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X, Pencil, Trash2, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Pagination } from "./admin.users";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  createMemberAccount,
  updateMember,
  changeMemberTier,
  deleteMember,
} from "@/server/members.functions";

export const Route = createFileRoute("/admin/members")({
  head: () => ({ meta: [{ title: "Members — Admin" }] }),
  component: MembersPage,
});

type Member = {
  id: string;
  user_id: string;
  member_id: string | null;
  contact_name: string;
  email: string;
  phone: string;
  company_name: string;
  tier: "associate" | "standard" | "corporate";
  status: string;
  industry: string | null;
  country: string;
  subscription_expiry: string | null;
};

function MembersPage() {
  const [rows, setRows] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [tierFor, setTierFor] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const create = useServerFn(createMemberAccount);
  const update = useServerFn(updateMember);
  const tierFn = useServerFn(changeMemberTier);
  const del = useServerFn(deleteMember);

  async function load() {
    const { data } = await supabase
      .from("member_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Member[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function submitCreate(e: React.FormEvent<HTMLFormElement>) {
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

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    try {
      await update({
        data: {
          user_id: editing.user_id,
          contact_name: String(fd.get("contact_name")),
          email: String(fd.get("email")),
          phone: String(fd.get("phone") ?? ""),
          company_name: String(fd.get("company_name") ?? ""),
          industry: String(fd.get("industry") ?? "") || null,
          country: String(fd.get("country") ?? "Ghana"),
          status: String(fd.get("status")) as any,
          subscription_expiry: String(fd.get("subscription_expiry") ?? "") || null,
        },
      });
      toast.success("Member updated");
      setEditing(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  async function submitTier(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!tierFor) return;
    const fd = new FormData(e.currentTarget);
    try {
      await tierFn({
        data: {
          user_id: tierFor.user_id,
          tier: String(fd.get("tier")) as any,
          regenerate_member_id: fd.get("regen") === "on",
          extend_subscription: fd.get("extend") === "on",
        },
      });
      toast.success("Tier updated");
      setTierFor(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del({ data: { user_id: deleting.user_id, delete_auth_user: true } });
      toast.success("Member deleted");
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (r.contact_name ?? "").toLowerCase().includes(s) ||
      (r.email ?? "").toLowerCase().includes(s) ||
      (r.company_name ?? "").toLowerCase().includes(s) ||
      (r.member_id ?? "").toLowerCase().includes(s)
    );
  });

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
      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, company, member ID…"
          className={inputCls + " max-w-md"}
        />
      </div>

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
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
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
                <td className="px-4 py-3 text-right">
                  <div className="relative inline-block">
                    <button
                      onClick={() => setMenuFor(menuFor === r.id ? null : r.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuFor === r.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuFor(null)}
                        />
                        <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                          <button
                            onClick={() => {
                              setEditing(r);
                              setMenuFor(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <Pencil className="h-4 w-4" /> Edit details
                          </button>
                          <button
                            onClick={() => {
                              setTierFor(r);
                              setMenuFor(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <ArrowUpDown className="h-4 w-4" /> Change tier
                          </button>
                          <button
                            onClick={() => {
                              setDeleting(r);
                              setMenuFor(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && <CreateModal onClose={() => setOpen(false)} onSubmit={submitCreate} />}
      {editing && (
        <EditModal member={editing} onClose={() => setEditing(null)} onSubmit={submitEdit} />
      )}
      {tierFor && (
        <TierModal member={tierFor} onClose={() => setTierFor(null)} onSubmit={submitTier} />
      )}
      {deleting && (
        <ConfirmDelete
          member={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </AdminShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
  maxW = "max-w-lg",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxW?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`w-full ${maxW} space-y-3 rounded-2xl bg-card p-6`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
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
    <ModalShell title="Create member account" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
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
    </ModalShell>
  );
}

function EditModal({
  member,
  onClose,
  onSubmit,
}: {
  member: Member;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const expiryDefault = member.subscription_expiry
    ? new Date(member.subscription_expiry).toISOString().slice(0, 10)
    : "";
  return (
    <ModalShell title={`Edit ${member.contact_name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Full name">
            <input name="contact_name" defaultValue={member.contact_name} required className={inputCls} />
          </FormField>
          <FormField label="Email">
            <input name="email" type="email" defaultValue={member.email} required className={inputCls} />
          </FormField>
          <FormField label="Phone">
            <input name="phone" defaultValue={member.phone ?? ""} className={inputCls} />
          </FormField>
          <FormField label="Company">
            <input name="company_name" defaultValue={member.company_name ?? ""} className={inputCls} />
          </FormField>
          <FormField label="Industry">
            <input name="industry" defaultValue={member.industry ?? ""} className={inputCls} />
          </FormField>
          <FormField label="Country">
            <input name="country" defaultValue={member.country ?? "Ghana"} className={inputCls} />
          </FormField>
          <FormField label="Status">
            <select name="status" defaultValue={member.status} className={inputCls}>
              <option value="new">New</option>
              <option value="reviewing">Reviewing</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </FormField>
          <FormField label="Subscription expiry">
            <input name="subscription_expiry" type="date" defaultValue={expiryDefault} className={inputCls} />
          </FormField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Save changes
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function TierModal({
  member,
  onClose,
  onSubmit,
}: {
  member: Member;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell title={`Change tier — ${member.contact_name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Current tier: <span className="font-semibold capitalize">{member.tier}</span>
        </p>
        <FormField label="New tier">
          <select name="tier" defaultValue={member.tier} className={inputCls}>
            <option value="associate">Associate</option>
            <option value="standard">Standard</option>
            <option value="corporate">Corporate</option>
          </select>
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="regen" /> Regenerate Member ID for new tier
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="extend" /> Reset subscription period from today
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Update tier
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ConfirmDelete({
  member,
  onClose,
  onConfirm,
}: {
  member: Member;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell title="Delete member" onClose={onClose} maxW="max-w-md">
      <p className="text-sm text-muted-foreground">
        This permanently deletes <span className="font-semibold text-foreground">{member.contact_name}</span>
        's profile and login account. This cannot be undone.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="rounded-full px-4 py-2 text-sm">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-destructive-foreground"
        >
          Delete permanently
        </button>
      </div>
    </ModalShell>
  );
}
