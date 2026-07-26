import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AppRole } from "@/components/auth/AuthProvider";
import { Save, Info } from "lucide-react";

export const Route = createFileRoute("/admin/roles")({
  head: () => ({ meta: [{ title: "Role Permissions — Admin" }] }),
  component: RolesPage,
});

const ROLES: AppRole[] = [
  "staff",
  "finance",
  "ceo",
  "coordinator",
  "developer",
  "member",
];

/** Groups of permission keys shown in the matrix. Keys match sidebar `to` paths. */
const GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: "Members",
    items: [
      { key: "/admin/applications", label: "Applications" },
      { key: "/admin/members", label: "Members" },
      { key: "/admin/directory", label: "Member Visibility" },
      { key: "/admin/directory-entries", label: "Directory Entries" },
      { key: "/admin/directory-fields", label: "Directory Fields" },
      { key: "/admin/readiness", label: "Readiness" },
      { key: "/admin/payments", label: "Payments" },
      { key: "/admin/tickets", label: "Support" },
    ],
  },
  {
    label: "Certificates",
    items: [
      { key: "/admin/certificates", label: "Cert Designer" },
      { key: "/admin/cert-batch", label: "Batch Issue" },
      { key: "/admin/cert-issued", label: "Issued Certs" },
    ],
  },
  {
    label: "Content",
    items: [
      { key: "/admin/news", label: "News & Blog" },
      { key: "/admin/products", label: "Products" },
      { key: "/admin/activities", label: "Events" },
      { key: "/admin/trade-opportunities", label: "Trade Opportunities" },
      { key: "/admin/media", label: "Media" },
      { key: "/admin/site-media", label: "Homepage Hero & Partners" },
      { key: "/admin/resources", label: "Resources" },
      { key: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Finance & Config",
    items: [
      { key: "/admin/plans", label: "Plans & Forms" },
      { key: "/admin/forms", label: "Form Builder" },
      { key: "/admin/gateways", label: "Gateways" },
      { key: "/admin/email-settings", label: "Email Settings" },
      { key: "/admin/email-templates", label: "Email Templates" },
      { key: "/admin/reports", label: "Reports" },
      { key: "/admin/backup", label: "Backup & Restore" },
      { key: "/admin/activity-log", label: "Activity Log" },
      { key: "/admin/users", label: "User Management" },
    ],
  },
];

// Built-in defaults per role (used as the initial checkbox state when no override is stored).
const DEFAULTS: Record<AppRole, Set<string>> = {
  admin: new Set(),
  superadmin: new Set(),
  member: new Set(),
  staff: new Set([
    "/admin/applications",
    "/admin/members",
    "/admin/directory",
    "/admin/directory-entries",
    "/admin/directory-fields",
    "/admin/tickets",
    "/admin/news",
    "/admin/products",
    "/admin/activities",
    "/admin/media",
    "/admin/site-media",
    "/admin/resources",
    "/admin/notifications",
  ]),
  finance: new Set(["/admin/payments", "/admin/reports"]),
  ceo: new Set(["/admin/payments", "/admin/reports"]),
  coordinator: new Set([
    "/admin/readiness",
    "/admin/certificates",
    "/admin/cert-batch",
    "/admin/cert-issued",
    "/admin/trade-opportunities",
  ]),
  developer: new Set([
    "/admin/plans",
    "/admin/forms",
    "/admin/gateways",
    "/admin/email-settings",
    "/admin/email-templates",
    "/admin/backup",
    "/admin/activity-log",
    "/admin/users",
  ]),
};

type MatrixState = Record<string, Record<AppRole, boolean>>;

function RolesPage() {
  const [state, setState] = useState<MatrixState>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const allKeys = useMemo(() => GROUPS.flatMap((g) => g.items.map((i) => i.key)), []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("role_permissions" as any)
        .select("role, permission_key, enabled");
      const ov = new Map<string, boolean>();
      ((data as any[]) ?? []).forEach((r) => ov.set(`${r.role}|${r.permission_key}`, r.enabled));
      const next: MatrixState = {};
      for (const key of allKeys) {
        next[key] = {} as Record<AppRole, boolean>;
        for (const role of ROLES) {
          const o = ov.get(`${role}|${key}`);
          next[key][role] = o !== undefined ? o : DEFAULTS[role].has(key);
        }
      }
      setState(next);
      setLoaded(true);
    })();
  }, [allKeys]);

  function toggle(key: string, role: AppRole) {
    setState((s) => ({ ...s, [key]: { ...s[key], [role]: !s[key]?.[role] } }));
  }

  async function save() {
    setSaving(true);
    try {
      const rows: { role: AppRole; permission_key: string; enabled: boolean }[] = [];
      for (const key of allKeys) {
        for (const role of ROLES) {
          rows.push({ role, permission_key: key, enabled: !!state[key]?.[role] });
        }
      }
      const { error } = await supabase
        .from("role_permissions" as any)
        .upsert(rows as any, { onConflict: "role,permission_key" });
      if (error) throw error;
      toast.success("Role permissions saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Role Permissions</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Control which admin-console sections each role can access. Admin and Superadmin always see everything.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Changes take effect on the next page load for affected users. A checked box grants access to that section for that role.</p>
      </div>

      <div className="space-y-6">
        {GROUPS.map((g) => (
          <div key={g.label} className="rounded-lg border bg-white overflow-hidden">
            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {g.label}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Section</th>
                    {ROLES.map((r) => (
                      <th key={r} className="px-3 py-2 text-center font-semibold capitalize">
                        {r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {g.items.map((it) => (
                    <tr key={it.key} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-medium text-slate-800">{it.label}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!state[it.key]?.[r]}
                            onChange={() => toggle(it.key, r)}
                            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
