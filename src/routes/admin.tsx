import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Newspaper, Package, CalendarDays, Image as ImageIcon, Users, LogOut, Home, CreditCard, Award, Bell, MessageCircle, Settings, BarChart3, Layers, ListChecks, AlertCircle, FormInput, Tag, UserPlus, DatabaseBackup } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — FAGE Ghana" }] }),
  component: AdminLayout,
});

const sections: ReadonlyArray<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/admin", label: "Overview", icon: Home, exact: true },
  { to: "/admin/applications", label: "Applications", icon: Users },
  { to: "/admin/members", label: "Members", icon: UserPlus },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/plans", label: "Plans & Forms", icon: Tag },
  { to: "/admin/forms", label: "Form Builder", icon: FormInput },
  { to: "/admin/gateways", label: "Gateways", icon: Settings },
  { to: "/admin/certificates", label: "Cert Designer", icon: Award, exact: true },
  { to: "/admin/cert-batch", label: "Batch Issue", icon: Layers },
  { to: "/admin/cert-issued", label: "Issued Certs", icon: ListChecks },
  { to: "/admin/news", label: "News", icon: Newspaper },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/activities", label: "Activities", icon: CalendarDays },
  { to: "/admin/media", label: "Media", icon: ImageIcon },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/tickets", label: "Support", icon: MessageCircle },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/backup", label: "Backup & Restore", icon: DatabaseBackup },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginRoute = location.pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) return;
    if (!loading && (!user || !isAdmin)) navigate({ to: "/admin/login" });
  }, [loading, user, isAdmin, navigate, isLoginRoute]);

  if (isLoginRoute) return <Outlet />;
  if (loading || !user || !isAdmin) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isOverview = location.pathname === "/admin";

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="border-b border-border p-5">
          <div className="font-bold">FAGE Admin</div>
          <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {sections.map((s) => {
            const active = s.exact ? location.pathname === s.to : location.pathname === s.to || location.pathname.startsWith(s.to + "/");
            return (
              <Link key={s.to} to={s.to} className={`mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                <s.icon className="h-4 w-4" /> {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link to="/" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
            <Home className="h-4 w-4" /> View site
          </Link>
          <button onClick={() => signOut()} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <div className="font-bold">FAGE Admin</div>
          <button onClick={() => signOut()} className="text-sm text-primary">Sign out</button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 lg:hidden">
          {sections.map((s) => {
            const active = s.exact ? location.pathname === s.to : location.pathname.startsWith(s.to);
            return (
              <Link key={s.to} to={s.to} className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </Link>
            );
          })}
        </div>
        {isOverview ? <AdminOverview /> : <Outlet />}
      </main>
    </div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState({ members: 0, active: 0, expiring: 0, pendingPay: 0, openTickets: 0, certs: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [m, payments, tickets, certs, apps] = await Promise.all([
        supabase.from("member_profiles").select("subscription_expiry", { count: "exact" }),
        supabase.from("payment_submissions").select("id", { count: "exact" }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact" }).eq("status", "open"),
        supabase.from("certificates").select("id", { count: "exact" }).gte("issued_at", monthStart),
        supabase.from("membership_applications").select("id, company_name, contact_name, created_at, status").order("created_at", { ascending: false }).limit(5),
      ]);
      const profiles = m.data ?? [];
      const active = profiles.filter((p: any) => p.subscription_expiry && new Date(p.subscription_expiry) > now).length;
      const expiring = profiles.filter((p: any) => p.subscription_expiry && new Date(p.subscription_expiry) > now && new Date(p.subscription_expiry) < in30).length;
      setStats({
        members: m.count ?? 0, active, expiring,
        pendingPay: payments.count ?? 0, openTickets: tickets.count ?? 0, certs: certs.count ?? 0,
      });
      setRecent(apps.data ?? []);
    })();
  }, []);

  const kpis = [
    { label: "Total members", value: stats.members, icon: Users, color: "bg-blue-100 text-blue-700" },
    { label: "Active subscriptions", value: stats.active, icon: BadgeIcon, color: "bg-emerald-100 text-emerald-700" },
    { label: "Expiring in 30 days", value: stats.expiring, icon: AlertCircle, color: "bg-amber-100 text-amber-700" },
    { label: "Pending payments", value: stats.pendingPay, icon: CreditCard, color: "bg-orange-100 text-orange-700" },
    { label: "Open tickets", value: stats.openTickets, icon: MessageCircle, color: "bg-purple-100 text-purple-700" },
    { label: "Certs issued (mo)", value: stats.certs, icon: Award, color: "bg-pink-100 text-pink-700" },
  ];

  const quickActions = [
    { to: "/admin/payments", label: "Review payments", icon: CreditCard },
    { to: "/admin/cert-batch", label: "Issue certificates", icon: Layers },
    { to: "/admin/certificates", label: "Design certificate", icon: Award },
    { to: "/admin/notifications", label: "Send announcement", icon: Bell },
    { to: "/admin/news", label: "Add news article", icon: Newspaper },
    { to: "/admin/gateways", label: "Payment gateways", icon: Settings },
  ];

  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-1 text-muted-foreground">Here's what's happening across FAGE Ghana.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map(k => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-4">
            <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${k.color}`}><k.icon className="h-4 w-4" /></div>
            <div className="text-2xl font-bold">{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold">Quick actions</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(q => (
          <Link key={q.to} to={q.to} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition hover:shadow-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><q.icon className="h-5 w-5" /></div>
            <div className="font-semibold">{q.label}</div>
          </Link>
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold">Recent applications</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
        {recent.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No applications yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase"><tr><th className="px-3 py-2 text-left">Company</th><th className="px-3 py-2 text-left">Contact</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>
              {recent.map(a => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2">{a.company_name}</td>
                  <td className="px-3 py-2">{a.contact_name}</td>
                  <td className="px-3 py-2">{new Date(a.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 capitalize">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BadgeIcon(props: any) { return <Award {...props} />; }
