import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ShieldCheck, ArrowLeft, KeyRound, UserCog } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account Settings — FAGE Ghana" }] }),
  component: AccountLayout,
});

const tabs = [
  { to: "/account/security", label: "Security", icon: KeyRound },
  // Profile editing lives in each role's dashboard for now; placeholder for future
  // { to: "/account/profile", label: "Profile", icon: UserCog },
];

function AccountLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const backTo = isAdmin ? "/admin" : "/dashboard";
  const isIndex = location.pathname === "/account" || location.pathname === "/account/";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to={backTo}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back to {isAdmin ? "Admin" : "Dashboard"}
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-1">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h1 className="text-base font-bold">Account</h1>
          </div>
          {tabs.map((t) => {
            const active = location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </aside>

        <main>
          {isIndex ? <SecurityRedirect /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

function SecurityRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/account/security", replace: true });
  }, [navigate]);
  return null;
}
