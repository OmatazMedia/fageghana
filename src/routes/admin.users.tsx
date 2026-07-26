import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, X, Trash2, MoreHorizontal, ShieldCheck, Users as UsersIcon, ExternalLink } from "lucide-react";
import { AdminShell, FormField, inputCls } from "@/components/admin/AdminShell";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  listAdminUsers,
  createAdminUser,
  changeUserRole,
  deleteAdminUser,
  type AdminUserRow,
} from "@/lib/users.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "User Management — Admin" }] }),
  component: UsersPage,
});

const ROLE_LABEL: Record<AdminUserRow["role"], string> = {
  admin: "Admin",
  superadmin: "Superadmin",
  staff: "Staff",
  moderator: "Moderator",
  finance: "Finance",
  ceo: "CEO",
  developer: "Developer",
  coordinator: "Coordinator",
};
const ROLE_COLOR: Record<AdminUserRow["role"], string> = {
  admin: "bg-primary/15 text-primary",
  superadmin: "bg-fuchsia-500/15 text-fuchsia-700",
  staff: "bg-blue-500/15 text-blue-600",
  moderator: "bg-amber-500/15 text-amber-700",
  finance: "bg-emerald-500/15 text-emerald-700",
  ceo: "bg-indigo-500/15 text-indigo-700",
  developer: "bg-slate-500/15 text-slate-700",
  coordinator: "bg-teal-500/15 text-teal-700",
};

function UsersPage() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [roleFor, setRoleFor] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const listFn = useServerFn(listAdminUsers);
  const createFn = useServerFn(createAdminUser);
  const roleFn = useServerFn(changeUserRole);
  const delFn = useServerFn(deleteAdminUser);

  async function load() {
    try {
      const res = await listFn();
      setRows(res.users);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to load users");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!q) return true;
        const s = q.toLowerCase();
        return (
          r.email.toLowerCase().includes(s) ||
          r.full_name.toLowerCase().includes(s) ||
          r.role.toLowerCase().includes(s)
        );
      }),
    [rows, q],
  );

  useEffect(() => {
    setPage(1);
  }, [q, pageSize]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  async function submitCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const mode = String(fd.get("mode")) as "password" | "invite";
    try {
      await createFn({
        data: {
          email: String(fd.get("email")),
          full_name: String(fd.get("full_name")),
          role: String(fd.get("role")) as any,
          mode,
          password: mode === "password" ? String(fd.get("password")) : undefined,
        },
      });
      toast.success("User created");
      setOpen(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  async function submitRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!roleFor) return;
    const fd = new FormData(e.currentTarget);
    try {
      await roleFn({
        data: { user_id: roleFor.user_id, role: String(fd.get("role")) as any },
      });
      toast.success("Role updated");
      setRoleFor(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await delFn({ data: { user_id: deleting.user_id } });
      toast.success("User deleted");
      setDeleting(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed");
    }
  }

  return (
    <AdminShell
      title="User Management"
      description="Manage members (subscription holders), staff, and admin accounts in one place."
      action={
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Add staff / admin
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
          <ShieldCheck className="h-4 w-4" /> Staff & Admins
        </span>
        <Link
          to="/admin/members"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <UsersIcon className="h-4 w-4" /> Members (subscriptions) <ExternalLink className="h-3 w-3" />
        </Link>
        <Link
          to="/admin/applications"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Applications <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or role…"
          className={inputCls + " max-w-md"}
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="px-4 py-3">{r.full_name || "—"}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLOR[r.role]}`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {ROLE_LABEL[r.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setRoleFor(r)}>
                          <ShieldCheck className="mr-2 h-4 w-4" /> Change role
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleting(r)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={total}
          start={start}
          pageSize={pageSize}
          setPage={setPage}
          setPageSize={setPageSize}
        />
      </div>

      {open && <CreateUserModal onClose={() => setOpen(false)} onSubmit={submitCreate} />}
      {roleFor && (
        <RoleModal user={roleFor} onClose={() => setRoleFor(null)} onSubmit={submitRole} />
      )}
      {deleting && (
        <ConfirmDeleteUser
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </AdminShell>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  start,
  pageSize,
  setPage,
  setPageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  pageSize: number;
  setPage: (n: number) => void;
  setPageSize: (n: number) => void;
}) {
  const end = Math.min(start + pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-lg border border-input bg-background px-2 py-1 text-sm"
        >
          {[25, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="text-muted-foreground">
        {total === 0 ? "0 results" : `Showing ${start + 1}–${end} of ${total}`}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2 text-xs text-muted-foreground">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
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

function CreateUserModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [mode, setMode] = useState<"password" | "invite">("invite");
  return (
    <ModalShell title="Add user" onClose={onClose} maxW="max-w-2xl">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Full name">
            <input name="full_name" required className={inputCls} />
          </FormField>
          <FormField label="Email">
            <input name="email" type="email" required className={inputCls} />
          </FormField>
        </div>
        <FormField label="Role" hint="Admin/Superadmin: full access · Staff/Finance/CEO/Coordinator/Developer: gated per role permissions matrix">
          <select name="role" required defaultValue="staff" className={inputCls}>
            <option value="admin">Admin (full access)</option>
            <option value="superadmin">Superadmin (full access)</option>
            <option value="staff">Staff (member management)</option>
            <option value="finance">Finance</option>
            <option value="ceo">CEO</option>
            <option value="coordinator">Project Coordinator</option>
            <option value="developer">Developer</option>
            <option value="moderator">Moderator (content only)</option>
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
            Create user
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RoleModal({
  user,
  onClose,
  onSubmit,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell title={`Change role — ${user.full_name || user.email}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Current role: <span className="font-semibold">{ROLE_LABEL[user.role]}</span>
        </p>
        <FormField label="New role">
          <select name="role" defaultValue={user.role} className={inputCls}>
            <option value="admin">Admin (full access)</option>
            <option value="superadmin">Superadmin (full access)</option>
            <option value="staff">Staff (member management)</option>
            <option value="finance">Finance</option>
            <option value="ceo">CEO</option>
            <option value="coordinator">Project Coordinator</option>
            <option value="developer">Developer</option>
            <option value="moderator">Moderator (content only)</option>
          </select>
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm">
            Cancel
          </button>
          <button className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            Update role
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ConfirmDeleteUser({
  user,
  onClose,
  onConfirm,
}: {
  user: AdminUserRow;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell title="Delete user" onClose={onClose} maxW="max-w-md">
      <p className="text-sm text-muted-foreground">
        This permanently removes{" "}
        <span className="font-semibold text-foreground">{user.email}</span> and revokes their
        access. This cannot be undone.
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
