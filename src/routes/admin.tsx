import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type React from "react";
import {
  Newspaper, Package, CalendarDays, Image as ImageIcon, Users, LogOut, Home,
  CreditCard, Award, Bell, MessageCircle, Settings, BarChart3, Layers,
  ListChecks, AlertCircle, FormInput, Tag, UserPlus, DatabaseBackup, Mail, FileText,
  ChevronRight, ExternalLink, TrendingUp, TrendingDown,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — FAGE Ghana" }] }),
  component: AdminLayout,
});

/* ── Nav types ────────────────────────────────────────────────────────── */
type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
};
type NavSection = { label: string; items: NavItem[] };

/* ── Nav sections ─────────────────────────────────────────────────────── */
const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: Home, exact: true },
    ],
  },
  {
    label: "Members",
    items: [
      { to: "/admin/applications", label: "Applications", icon: Users },
      { to: "/admin/members", label: "Members", icon: UserPlus },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
      { to: "/admin/tickets", label: "Support", icon: MessageCircle },
    ],
  },
  {
    label: "Certificates",
    items: [
      { to: "/admin/certificates", label: "Cert Designer", icon: Award, exact: true },
      { to: "/admin/cert-batch", label: "Batch Issue", icon: Layers },
      { to: "/admin/cert-issued", label: "Issued Certs", icon: ListChecks },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/news", label: "News", icon: Newspaper },
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/activities", label: "Activities", icon: CalendarDays },
      { to: "/admin/media", label: "Media", icon: ImageIcon },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Finance & Config",
    items: [
      { to: "/admin/plans", label: "Plans & Forms", icon: Tag },
      { to: "/admin/forms", label: "Form Builder", icon: FormInput },
      { to: "/admin/gateways", label: "Gateways", icon: Settings },
      { to: "/admin/email-settings", label: "Email Settings", icon: Mail },
      { to: "/admin/email-templates", label: "Email Templates", icon: FileText },
      { to: "/admin/reports", label: "Reports", icon: BarChart3 },
      { to: "/admin/backup", label: "Backup & Restore", icon: DatabaseBackup },
    ],
  },
];

/* ── Layout ───────────────────────────────────────────────────────────── */
function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginRoute = location.pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) return;
    if (!loading && !user) navigate({ to: "/", replace: true });
    else if (!loading && user && !isAdmin) navigate({ to: "/", replace: true });
  }, [loading, user, isAdmin, navigate, isLoginRoute]);

  if (isLoginRoute) return <Outlet />;
  if (loading || !user || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1a14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-white/50">Loading…</span>
        </div>
      </div>
    );
  }

  const isOverview = location.pathname === "/admin";
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "AD";

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f5]">

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0f1a14] lg:flex h-screen sticky top-0">

        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <img
            src="/images/logos/fage-logo-white.webp"
            alt="FAGE"
            className="h-8 w-auto object-contain"
          />
          <div className="leading-tight">
            <div className="text-xs font-bold uppercase tracking-widest text-white/90">Admin</div>
            <div className="text-[10px] text-white/40">Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                {section.label}
              </div>
              {section.items.map((s) => {
                const active = "exact" in s && s.exact
                  ? location.pathname === s.to
                  : location.pathname === s.to || location.pathname.startsWith(s.to + "/");
                return (
                  <Link
                    key={s.to}
                    to={s.to}
                    className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      active
                        ? "bg-primary text-white shadow-sm shadow-primary/30"
                        : "text-white/60 hover:bg-white/8 hover:text-white"
                    }`}
                  >
                    <s.icon className="h-4 w-4 shrink-0" />
                    {s.label}
                    {active && <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-3 space-y-0.5">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
          >
            <ExternalLink className="h-4 w-4" /> View site
          </Link>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">

        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/images/logos/fage-logo-main.webp" alt="FAGE" className="h-7 w-auto" />
            <span className="font-bold text-sm">Admin</span>
          </div>

          {/* Breadcrumb — desktop */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">FAGE Admin</span>
            {location.pathname !== "/admin" && (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="capitalize text-foreground">
                  {location.pathname.split("/").filter(Boolean).slice(1).join(" / ").replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right lg:block">
              <div className="text-xs font-semibold text-foreground leading-none">{user.email?.split("@")[0]}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Administrator</div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow">
              {initials}
            </div>
            <button
              onClick={() => signOut()}
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </header>

        {/* Mobile nav */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-white px-3 py-2 lg:hidden">
          {navSections.flatMap(s => s.items).map((s) => {
            const active = "exact" in s && s.exact
              ? location.pathname === s.to
              : location.pathname.startsWith(s.to);
            return (
              <Link
                key={s.to}
                to={s.to}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  active ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {isOverview ? <AdminOverview /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────── */
function AdminOverview() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    members: 0, active: 0, expiring: 0,
    pendingPay: 0, openTickets: 0, certs: 0,
  });
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
        supabase.from("membership_applications")
          .select("id, company_name, contact_name, created_at, status")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      const profiles = m.data ?? [];
      const active = profiles.filter((p: any) => p.subscription_expiry && new Date(p.subscription_expiry) > now).length;
      const expiring = profiles.filter((p: any) => p.subscription_expiry && new Date(p.subscription_expiry) > now && new Date(p.subscription_expiry) < in30).length;
      setStats({ members: m.count ?? 0, active, expiring, pendingPay: payments.count ?? 0, openTickets: tickets.count ?? 0, certs: certs.count ?? 0 });
      setRecent(apps.data ?? []);
    })();
  }, []);

  const firstName = user?.email?.split("@")[0] ?? "Admin";

  const kpis = [
    { label: "Total members", value: stats.members, icon: Users, bg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100", trend: "up" },
    { label: "Active subscriptions", value: stats.active, icon: Award, bg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100", trend: "up" },
    { label: "Expiring in 30 days", value: stats.expiring, icon: AlertCircle, bg: "bg-amber-50", iconColor: "text-amber-600", border: "border-amber-100", trend: "warn" },
    { label: "Pending payments", value: stats.pendingPay, icon: CreditCard, bg: "bg-orange-50", iconColor: "text-orange-600", border: "border-orange-100", trend: "warn" },
    { label: "Open tickets", value: stats.openTickets, icon: MessageCircle, bg: "bg-purple-50", iconColor: "text-purple-600", border: "border-purple-100", trend: "down" },
    { label: "Certs issued (mo)", value: stats.certs, icon: Award, bg: "bg-pink-50", iconColor: "text-pink-600", border: "border-pink-100", trend: "up" },
  ];

  const quickActions = [
    { to: "/admin/payments", label: "Review payments", desc: "Confirm pending submissions", icon: CreditCard, bg: "bg-orange-50", iconColor: "text-orange-600" },
    { to: "/admin/cert-batch", label: "Issue certificates", desc: "Batch issue to members", icon: Layers, bg: "bg-purple-50", iconColor: "text-purple-600" },
    { to: "/admin/certificates", label: "Design certificate", desc: "Edit certificate template", icon: Award, bg: "bg-pink-50", iconColor: "text-pink-600" },
    { to: "/admin/notifications", label: "Send announcement", desc: "Broadcast to all members", icon: Bell, bg: "bg-blue-50", iconColor: "text-blue-600" },
    { to: "/admin/news", label: "Add news article", desc: "Publish to the website", icon: Newspaper, bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { to: "/admin/gateways", label: "Payment gateways", desc: "Configure Paystack / Hubtel", icon: Settings, bg: "bg-slate-50", iconColor: "text-slate-600" },
  ];

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
    review:   { label: "In Review", cls: "bg-blue-100 text-blue-700" },
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">

      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          Good {getGreeting()}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what's happening across FAGE Ghana today.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div
            key={k.label}
            className={`relative overflow-hidden rounded-2xl border ${k.border} ${k.bg} p-5`}
          >
            <div className="flex items-start justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${k.iconColor}`}>
                <k.icon className="h-4.5 w-4.5" />
              </div>
              {k.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              {k.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
              {k.trend === "warn" && k.value > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="mt-3 text-3xl font-bold text-foreground">{k.value}</div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground leading-tight">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-10">
        <h2 className="mb-4 text-base font-bold text-foreground">Quick actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((q) => (
            <Link
              key={q.to}
              to={q.to}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${q.bg} ${q.iconColor} transition group-hover:scale-110`}>
                <q.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">{q.label}</div>
                <div className="text-xs text-muted-foreground truncate">{q.desc}</div>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/40 transition group-hover:text-primary group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Recent applications */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Recent applications</h2>
          <Link to="/admin/applications" className="text-xs font-medium text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
              <Users className="mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">No applications yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a, i) => {
                  const s = statusConfig[a.status] ?? { label: a.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={a.id} className={`border-t border-border transition hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{a.company_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.contact_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
