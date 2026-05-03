import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Newspaper, Package, CalendarDays, Image as ImageIcon, Users, LogOut, Home, CreditCard, Award, Bell, MessageCircle, Settings } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — FAGE Ghana" }] }),
  component: AdminLayout,
});

const sections: ReadonlyArray<{ to: string; label: string; icon: typeof Home; exact?: boolean }> = [
  { to: "/admin", label: "Overview", icon: Home, exact: true },
  { to: "/admin/news", label: "News", icon: Newspaper },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/activities", label: "Activities", icon: CalendarDays },
  { to: "/admin/media", label: "Media", icon: ImageIcon },
  { to: "/admin/applications", label: "Applications", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/gateways", label: "Gateways", icon: Settings },
  { to: "/admin/certificates", label: "Certificates", icon: Award },
  { to: "/admin/notifications", label: "Notifications", icon: Bell },
  { to: "/admin/tickets", label: "Support", icon: MessageCircle },
];

function AdminLayout() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // The /admin/login child route must render publicly — never gate it.
  const isLoginRoute = location.pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) return;
    if (!loading && (!user || !isAdmin)) navigate({ to: "/admin/login" });
  }, [loading, user, isAdmin, navigate, isLoginRoute]);

  if (isLoginRoute) {
    return <Outlet />;
  }

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
        <nav className="flex-1 p-3">
          {sections.map((s) => {
            const active = s.exact ? location.pathname === s.to : location.pathname.startsWith(s.to);
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
        {/* Mobile header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <div className="font-bold">FAGE Admin</div>
          <button onClick={() => signOut()} className="text-sm text-primary">Sign out</button>
        </div>
        {/* Mobile nav */}
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
  return (
    <div className="p-6 lg:p-10">
      <h1 className="text-3xl font-bold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Manage your site content from here.</p>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.filter(s => !s.exact).map((s) => (
          <Link key={s.to} to={s.to} className="rounded-2xl border border-border bg-card p-6 transition hover:shadow-md">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-bold">{s.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Manage {s.label.toLowerCase()}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
