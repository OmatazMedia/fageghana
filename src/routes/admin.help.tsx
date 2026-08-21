// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRolePermissions } from "@/lib/role-permissions";
import {
  ROLE_HELP_DEFAULTS,
  HELP_ROLE_ORDER,
  roleTitle,
  isFullAccess,
} from "@/lib/role-help";

type HelpRow = { role: string; summary: string; details: string | null };

export const Route = createFileRoute("/admin/help")({
  head: () => ({
    meta: [
      { title: "Help Guide — FAGE Admin" },
      {
        name: "description",
        content:
          "What every FAGE role can do in the console, generated from the live permission matrix.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HelpGuidePage,
});

function HelpGuidePage() {
  const { roles: myRoles } = useAuth();
  const { overrides, loaded } = useRolePermissions();
  const [rows, setRows] = useState<Record<string, HelpRow>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const canEdit = isFullAccess(myRoles);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("role_help" as any)
        .select("role, summary, details");
      const map: Record<string, HelpRow> = {};
      ((data as HelpRow[] | null) ?? []).forEach((r) => (map[r.role] = r));
      setRows(map);
    })();
  }, []);

  /** Pages each role has been explicitly granted in the permission matrix. */
  const grantedByRole = useMemo(() => {
    const m: Record<string, string[]> = {};
    overrides.forEach((enabled, key) => {
      const [role, permKey] = key.split("|");
      if (!enabled || !role || !permKey) return;
      (m[role] ??= []).push(permKey);
    });
    Object.values(m).forEach((a) => a.sort());
    return m;
  }, [overrides]);

  // Show my own role first, then the rest.
  const ordered = useMemo(() => {
    const mine = HELP_ROLE_ORDER.filter((r) => myRoles.includes(r as any));
    return [...mine, ...HELP_ROLE_ORDER.filter((r) => !mine.includes(r))];
  }, [myRoles]);

  const visible = canEdit ? ordered : ordered.filter((r) => myRoles.includes(r as any) || r === "user");

  async function save(role: string) {
    setSaving(role);
    const row = rows[role];
    const { error } = await supabase.from("role_help" as any).upsert(
      {
        role,
        summary: row?.summary ?? ROLE_HELP_DEFAULTS[role]?.summary ?? "",
        details: row?.details ?? null,
      } as any,
      { onConflict: "role" },
    );
    setSaving(null);
    if (error) toast.error(error.message);
    else toast.success(`${roleTitle(role)} help saved`);
  }

  return (
    <AdminShell
      title="Help Guide"
      description="What each role can do. Descriptions are editable and the page list comes from the live permission matrix."
    >
      <div className="space-y-4">
        {visible.map((role) => {
          const row = rows[role];
          const summary = row?.summary ?? ROLE_HELP_DEFAULTS[role]?.summary ?? "";
          const details = row?.details ?? "";
          const granted = grantedByRole[role] ?? [];
          const isMine = myRoles.includes(role as any);
          return (
            <section
              key={role}
              className={`rounded-2xl border bg-card p-5 ${isMine ? "border-primary/60" : "border-border"}`}
            >
              <header className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">{roleTitle(role)}</h2>
                {isMine && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Your role
                  </span>
                )}
              </header>

              {canEdit ? (
                <div className="space-y-2">
                  <textarea
                    value={summary}
                    onChange={(e) =>
                      setRows((r) => ({
                        ...r,
                        [role]: { role, summary: e.target.value, details: r[role]?.details ?? null },
                      }))
                    }
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="One-line summary of this role"
                  />
                  <textarea
                    value={details}
                    onChange={(e) =>
                      setRows((r) => ({
                        ...r,
                        [role]: {
                          role,
                          summary: r[role]?.summary ?? summary,
                          details: e.target.value,
                        },
                      }))
                    }
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Step-by-step guidance for people with this role (optional)"
                  />
                  <button
                    onClick={() => save(role)}
                    disabled={saving === role}
                    className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    <Save className="h-3.5 w-3.5" /> {saving === role ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{summary}</p>
                  {details && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                      {details}
                    </p>
                  )}
                </>
              )}

              {loaded && granted.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-semibold">Pages granted in the permission matrix</p>
                  <div className="flex flex-wrap gap-1.5">
                    {granted.map((g) => (
                      <span key={g} className="rounded bg-muted px-2 py-0.5 text-[11px]">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </AdminShell>
  );
}
