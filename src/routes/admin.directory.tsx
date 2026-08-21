import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/directory")({
  head: () => ({ meta: [{ title: "Member Directory — FAGE Admin" }] }),
  component: DirectoryAdmin,
});

type Row = {
  id: string;
  user_id: string;
  member_id: string | null;
  contact_name: string;
  company_name: string;
  email: string;
  tier: string;
  status: string;
  directory_visible: boolean;
};

function DirectoryAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("member_profiles")
      .select("id, user_id, member_id, contact_name, company_name, email, tier, status, directory_visible")
      .eq("status", "approved")
      .order("company_name");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as Row[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function toggle(row: Row) {
    const { error } = await supabase
      .from("member_profiles")
      .update({ directory_visible: !row.directory_visible })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success(row.directory_visible ? "Hidden from directory" : "Shown in directory");
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, directory_visible: !r.directory_visible } : r)),
      );
    }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.company_name, r.contact_name, r.email, r.member_id ?? ""].some((v) =>
        v.toLowerCase().includes(term),
      ),
    );
  }, [rows, q]);

  const visibleCount = rows.filter((r) => r.directory_visible).length;

  return (
    <AdminShell
      title="Member Directory"
      description={`${visibleCount} of ${rows.length} approved members are visible in the public directory.`}
      action={
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="rounded-full border border-input bg-background py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Member ID</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Directory</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{r.company_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{r.contact_name}</div>
                    <div className="text-xs">{r.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.member_id ?? "—"}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{r.tier}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(r)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${r.directory_visible ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}
                    >
                      {r.directory_visible ? "Visible" : "Hidden"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
