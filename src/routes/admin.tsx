import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useEffect, useRef, useState } from "react";
import type React from "react";
import {
  Newspaper,
  Package,
  CalendarDays,
  Image as ImageIcon,
  Users,
  LogOut,
  Home,
  CreditCard,
  Award,
  Bell,
  MessageCircle,
  Settings,
  BarChart3,
  Layers,
  ListChecks,
  AlertCircle,
  FormInput,
  Tag,
  UserPlus,
  DatabaseBackup,
  Mail,
  FileText,
  ChevronRight,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Building2,
  BookOpen,
  KeyRound,
  CloudUpload,
  Menu,
  X,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRolePermissions } from "@/lib/role-permissions";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — FAGE Ghana" }] }),
  component: AdminLayout,
});

/* ── Nav types ────────────────────────────────────────────────────────── */
import type { AppRole } from "@/components/auth/AuthProvider";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  /** If omitted, item is visible to every admin-console role. */
  roles?: AppRole[];
};
type NavSection = { label: string; items: NavItem[]; roles?: AppRole[] };

// Role convenience buckets
const ANY_ADMIN: AppRole[] = ["admin", "superadmin"];
const FINANCE_VIEW: AppRole[] = ["admin", "superadmin", "finance", "ceo"];
const DEV_ONLY: AppRole[] = ["developer", "superadmin"];
const CERT_ROLES: AppRole[] = ["admin", "superadmin", "coordinator"];
const TRADE_ROLES: AppRole[] = ["admin", "superadmin", "coordinator"];

/* ── Nav sections ─────────────────────────────────────────────────────── */
const navSections: NavSection[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: Home, exact: true }],
  },
  {
    label: "Members",
    roles: ANY_ADMIN,
    items: [
      { to: "/admin/applications", label: "Applications", icon: Users },
      { to: "/admin/members", label: "Members", icon: UserPlus },
      { to: "/admin/directory", label: "Member Visibility", icon: Users },
      { to: "/admin/directory-entries", label: "Directory Entries", icon: Building2 },
      { to: "/admin/directory-fields", label: "Directory Fields", icon: FormInput },
      { to: "/admin/readiness", label: "Readiness", icon: ListChecks, roles: CERT_ROLES },
      { to: "/admin/payments", label: "Payments", icon: CreditCard, roles: FINANCE_VIEW },
      { to: "/admin/tickets", label: "Support", icon: MessageCircle },
    ],
  },
  {
    label: "Certificates",
    roles: CERT_ROLES,
    items: [
      { to: "/admin/certificates", label: "Cert Designer", icon: Award, exact: true },
      { to: "/admin/cert-batch", label: "Batch Issue", icon: Layers },
      { to: "/admin/cert-issued", label: "Issued Certs", icon: ListChecks },
    ],
  },
  {
    label: "Content",
    roles: ANY_ADMIN,
    items: [
      { to: "/admin/news", label: "News & Blog", icon: Newspaper },
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/activities", label: "Events", icon: CalendarDays },
      { to: "/admin/trade-opportunities", label: "Trade Opportunities", icon: TrendingUp, roles: TRADE_ROLES },
      { to: "/admin/media", label: "Media", icon: ImageIcon },
      { to: "/admin/site-media", label: "Homepage Hero & Partners", icon: ImageIcon },
      { to: "/admin/resources", label: "Resources", icon: BookOpen },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
      { to: "/admin/chatbot", label: "Chatbot Knowledge", icon: MessageCircle, roles: ANY_ADMIN },
      { to: "/admin/chatbot-feedback", label: "Chatbot Feedback", icon: MessageCircle, roles: ANY_ADMIN },
    ],
  },
  {
    label: "Finance & Config",
    items: [
      { to: "/admin/plans", label: "Plans & Forms", icon: Tag, roles: DEV_ONLY },
      { to: "/admin/forms", label: "Form Builder", icon: FormInput, roles: DEV_ONLY },
      { to: "/admin/gateways", label: "Gateways", icon: Settings, roles: DEV_ONLY },
      { to: "/admin/email-settings", label: "Email Settings", icon: Mail, roles: DEV_ONLY },
      { to: "/admin/email-templates", label: "Email Templates", icon: FileText, roles: DEV_ONLY },
      { to: "/admin/reports", label: "Reports", icon: BarChart3, roles: FINANCE_VIEW },
      { to: "/admin/backup", label: "Backup & Restore", icon: DatabaseBackup, roles: DEV_ONLY },
      { to: "/admin/backup-destinations", label: "Backup Destinations", icon: CloudUpload, roles: DEV_ONLY },
      { to: "/admin/activity-log", label: "Activity Log", icon: ListChecks, roles: DEV_ONLY },
      { to: "/admin/users", label: "User Management", icon: ShieldCheck, roles: DEV_ONLY },
      { to: "/admin/roles", label: "Role Permissions", icon: KeyRound, roles: ANY_ADMIN },
    ],
  },
];

function filterNav(
  sections: NavSection[],
  has: (r: AppRole[]) => boolean,
  userRoles: AppRole[],
  isAllowed: (roles: AppRole[], key: string, staticRoles?: AppRole[]) => boolean,
): NavSection[] {
  return sections
    .filter((s) => !s.roles || has(s.roles))
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => isAllowed(userRoles, i.to, i.roles)),
    }))
    .filter((s) => s.items.length > 0);
}

/* ── Layout ───────────────────────────────────────────────────────────── */
function AdminLayout() {
  const { user, isAdmin, hasAnyRole, roles: userRoles, loading, roleChecked, signOut } = useAuth();
  const { isAllowed } = useRolePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoginRoute = location.pathname === "/admin/login";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Auto-close mobile drawer whenever route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Anyone with a role that maps to at least one admin-console section.
  const canAccessConsole =
    isAdmin ||
    hasAnyRole(["staff", "finance", "ceo", "developer", "coordinator"]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("You have been successfully signed out");
    navigate({ to: "/admin/login", replace: true });
  };

  // Paths only developer/superadmin may hit directly (mirrors sidebar DEV_ONLY items).
  const DEV_ONLY_PATHS = [
    "/admin/plans",
    "/admin/forms",
    "/admin/gateways",
    "/admin/email-settings",
    "/admin/email-templates",
    "/admin/backup",
    "/admin/activity-log",
    "/admin/users",
  ];
  const isDevPath = DEV_ONLY_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
  );
  const hasDev = hasAnyRole(["developer", "superadmin", "admin"]);

  useEffect(() => {
    if (isLoginRoute) return;
    if (loading || !roleChecked) return;
    if (!user) navigate({ to: "/admin/login", replace: true });
    else if (!canAccessConsole) navigate({ to: "/", replace: true });
    else if (isDevPath && !hasDev) {
      toast.error("This section is restricted to developers.");
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, roleChecked, user, canAccessConsole, navigate, isLoginRoute, isDevPath, hasDev]);

  if (isLoginRoute) return <Outlet />;
  if (loading || !roleChecked || !user || !canAccessConsole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f1a14]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-white/50">Loading…</span>
        </div>
      </div>
    );
  }

  const visibleNav = filterNav(navSections, hasAnyRole, userRoles, isAllowed);
  const isOverview = location.pathname === "/admin";
  const initials = user.email?.slice(0, 2).toUpperCase() ?? "AD";


  const sidebarInner = (
    <>
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
        {visibleNav.map((section) => (
          <div key={section.label}>
            <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {section.label}
            </div>
            {section.items.map((s) => {
              const active =
                "exact" in s && s.exact
                  ? location.pathname === s.to
                  : location.pathname === s.to || location.pathname.startsWith(s.to + "/");
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  onClick={() => setMobileNavOpen(false)}
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
          to="/admin/account/security"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-all"
        >
          <ShieldCheck className="h-4 w-4" /> Account & Security
        </Link>
        <Link
          to="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
        >
          <ExternalLink className="h-4 w-4" /> View site
        </Link>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f5]">
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0f1a14] lg:flex h-screen sticky top-0 overflow-hidden">
        {sidebarInner}
      </aside>

      {/* ── Mobile drawer sidebar ───────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          mobileNavOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileNavOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col bg-[#0f1a14] shadow-2xl transition-transform duration-300 ease-out ${
            mobileNavOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setMobileNavOpen(false)}
            className="absolute right-3 top-3 rounded p-1 text-white/60 hover:bg-white/10 z-10"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          {sidebarInner}
        </aside>
      </div>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
          {/* Mobile hamburger + logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="group flex h-9 w-9 flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-accent transition"
              aria-label="Open menu"
            >
              <span className="block h-[2px] w-5 rounded bg-foreground transition-transform group-hover:translate-x-0.5" />
              <span className="block h-[2px] w-5 rounded bg-foreground" />
              <span className="block h-[2px] w-5 rounded bg-foreground transition-transform group-hover:-translate-x-0.5" />
            </button>
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
                  {location.pathname
                    .split("/")
                    .filter(Boolean)
                    .slice(1)
                    .join(" / ")
                    .replace(/-/g, " ")}
                </span>
              </>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-2">
            <NotificationBell scope="admin" />
            <AdminUserMenu
              email={user.email ?? ""}
              initials={initials}
              onSignOut={handleSignOut}
            />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{isOverview ? <AdminOverview /> : <Outlet />}</main>
      </div>
    </div>
  );
}

/* ── Overview ─────────────────────────────────────────────────────────── */
function AdminOverview() {
  const { user, hasAnyRole } = useAuth();
  const canFinance = hasAnyRole(["admin", "superadmin", "developer", "finance", "ceo"]);
  const canCerts = hasAnyRole(["admin", "superadmin", "developer", "coordinator"]);
  const canContent = hasAnyRole(["admin", "superadmin", "developer", "staff"]);
  const canDev = hasAnyRole(["admin", "superadmin", "developer"]);
  const [stats, setStats] = useState({
    members: 0,
    active: 0,
    expiring: 0,
    pendingPay: 0,
    openTickets: 0,
    certs: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const now = new Date();
      const in30 = new Date(now.getTime() + 30 * 86400000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [m, payments, tickets, certs, apps] = await Promise.all([
        supabase.from("member_profiles").select("subscription_expiry", { count: "exact" }),
        supabase
          .from("payment_submissions")
          .select("id", { count: "exact" })
          .eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact" }).eq("status", "open"),
        supabase.from("certificates").select("id", { count: "exact" }).gte("issued_at", monthStart),
        supabase
          .from("membership_applications")
          .select("id, company_name, contact_name, created_at, status")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      const profiles = m.data ?? [];
      const active = profiles.filter(
        (p: any) => p.subscription_expiry && new Date(p.subscription_expiry) > now,
      ).length;
      const expiring = profiles.filter(
        (p: any) =>
          p.subscription_expiry &&
          new Date(p.subscription_expiry) > now &&
          new Date(p.subscription_expiry) < in30,
      ).length;
      setStats({
        members: m.count ?? 0,
        active,
        expiring,
        pendingPay: payments.count ?? 0,
        openTickets: tickets.count ?? 0,
        certs: certs.count ?? 0,
      });
      setRecent(apps.data ?? []);
    })();
  }, []);

  const firstName = user?.email?.split("@")[0] ?? "Admin";

  const allKpis = [
    { key: "members", label: "Total members", value: stats.members, icon: Users, bg: "bg-blue-50", iconColor: "text-blue-600", border: "border-blue-100", trend: "up", show: true },
    { key: "active", label: "Active subscriptions", value: stats.active, icon: Award, bg: "bg-emerald-50", iconColor: "text-emerald-600", border: "border-emerald-100", trend: "up", show: canFinance || canCerts },
    { key: "expiring", label: "Expiring in 30 days", value: stats.expiring, icon: AlertCircle, bg: "bg-amber-50", iconColor: "text-amber-600", border: "border-amber-100", trend: "warn", show: canFinance },
    { key: "pendingPay", label: "Pending payments", value: stats.pendingPay, icon: CreditCard, bg: "bg-orange-50", iconColor: "text-orange-600", border: "border-orange-100", trend: "warn", show: canFinance },
    { key: "openTickets", label: "Open tickets", value: stats.openTickets, icon: MessageCircle, bg: "bg-purple-50", iconColor: "text-purple-600", border: "border-purple-100", trend: "down", show: canContent || canDev },
    { key: "certs", label: "Certs issued (mo)", value: stats.certs, icon: Award, bg: "bg-pink-50", iconColor: "text-pink-600", border: "border-pink-100", trend: "up", show: canCerts },
  ];
  const kpis = allKpis.filter((k) => k.show);

  const allActions = [
    { to: "/admin/payments", label: "Review payments", desc: "Confirm pending submissions", icon: CreditCard, bg: "bg-orange-50", iconColor: "text-orange-600", show: canFinance },
    { to: "/admin/cert-batch", label: "Issue certificates", desc: "Batch issue to members", icon: Layers, bg: "bg-purple-50", iconColor: "text-purple-600", show: canCerts },
    { to: "/admin/certificates", label: "Design certificate", desc: "Edit certificate template", icon: Award, bg: "bg-pink-50", iconColor: "text-pink-600", show: canCerts },
    { to: "/admin/notifications", label: "Send announcement", desc: "Broadcast to all members", icon: Bell, bg: "bg-blue-50", iconColor: "text-blue-600", show: canContent },
    { to: "/admin/news", label: "Add news article", desc: "Publish to the website", icon: Newspaper, bg: "bg-emerald-50", iconColor: "text-emerald-600", show: canContent },
    { to: "/admin/gateways", label: "Payment gateways", desc: "Configure Paystack / Hubtel", icon: Settings, bg: "bg-slate-50", iconColor: "text-slate-600", show: canDev },
  ];
  const quickActions = allActions.filter((a) => a.show);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700" },
    approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700" },
    review: { label: "In Review", cls: "bg-blue-100 text-blue-700" },
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
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ${k.iconColor}`}
              >
                <k.icon className="h-4.5 w-4.5" />
              </div>
              {k.trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
              {k.trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-400" />}
              {k.trend === "warn" && k.value > 0 && (
                <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="mt-3 text-3xl font-bold text-foreground">{k.value}</div>
            <div className="mt-0.5 text-xs font-medium text-muted-foreground leading-tight">
              {k.label}
            </div>
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
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${q.bg} ${q.iconColor} transition group-hover:scale-110`}
              >
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
          <Link
            to="/admin/applications"
            className="text-xs font-medium text-primary hover:underline"
          >
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((a, i) => {
                  const s = statusConfig[a.status] ?? {
                    label: a.status,
                    cls: "bg-muted text-muted-foreground",
                  };
                  return (
                    <tr
                      key={a.id}
                      className={`border-t border-border transition hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{a.company_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{a.contact_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
                        >
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

function AdminUserMenu({
  email,
  initials,
  onSignOut,
}: {
  email: string;
  initials: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm hover:bg-accent transition"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {initials}
        </span>
        <span className="hidden text-left lg:block leading-tight">
          <span className="block text-xs font-semibold">{email.split("@")[0]}</span>
          <span className="block text-[10px] text-muted-foreground">Administrator</span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <Link
            to="/admin/account/security"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
          >
            <UserIcon className="h-4 w-4" /> Profile
          </Link>
          <Link
            to="/admin/account/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
          >
            <ShieldCheck className="h-4 w-4" /> Account &amp; security
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
