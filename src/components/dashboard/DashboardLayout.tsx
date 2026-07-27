import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  LogOut,
  Home,
  CreditCard,
  FileDown,
  CalendarDays,
  TrendingUp,
  Users,
  ShieldCheck,
  BookOpen,
  FolderOpen,
  Receipt,
  Bell,
  MailCheck,
  MessageCircle,
  Settings,
  KeyRound,
  Menu,
  X,
  ChevronDown,
  User as UserIcon,
  Building2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type Item = { label: string; icon: any; to: string; tab?: string };

const TAB_ITEMS: Item[] = [
  { label: "Overview", icon: Home, to: "/dashboard", tab: "overview" },
  { label: "Subscription", icon: CreditCard, to: "/dashboard", tab: "subscription" },
  { label: "Certificate", icon: FileDown, to: "/dashboard", tab: "certificate" },
  { label: "Events", icon: CalendarDays, to: "/dashboard", tab: "events" },
  { label: "Trade Opportunities", icon: TrendingUp, to: "/dashboard", tab: "trade" },
  { label: "Member Directory", icon: Users, to: "/dashboard", tab: "directory" },
  { label: "My Directory Listing", icon: Building2, to: "/dashboard", tab: "my-listing" },
  { label: "Readiness Score", icon: ShieldCheck, to: "/dashboard", tab: "readiness" },
  { label: "Resources", icon: BookOpen, to: "/dashboard", tab: "resources" },
  { label: "My Documents", icon: FolderOpen, to: "/dashboard", tab: "documents" },
  { label: "Invoice History", icon: Receipt, to: "/dashboard", tab: "invoices" },
  { label: "Notifications", icon: Bell, to: "/dashboard", tab: "notifications" },
  { label: "Email Preferences", icon: MailCheck, to: "/dashboard", tab: "email-prefs" },
  { label: "Support", icon: MessageCircle, to: "/dashboard", tab: "support" },
  { label: "Profile", icon: Settings, to: "/dashboard", tab: "profile" },
];

const ACCOUNT_ITEMS: Item[] = [
  { label: "Account & Security", icon: ShieldCheck, to: "/account/security" },
  { label: "Change Password", icon: KeyRound, to: "/account/change-password" },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const activeTab = typeof search?.tab === "string" ? (search.tab as string) : "overview";

  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("member_profiles")
      .select("contact_name,email,member_id,tier,subscription_expiry")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user]);

  const initials = (profile?.contact_name || profile?.email || user?.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function isActive(item: Item) {
    if (item.tab) {
      return pathname === "/dashboard" && activeTab === item.tab;
    }
    return pathname === item.to || pathname.startsWith(item.to + "/");
  }

  const navList = (items: Item[]) => (
    <div className="space-y-0.5">
      {items.map((it) => {
        const active = isActive(it);
        const linkProps: any = it.tab
          ? { to: "/dashboard", search: { tab: it.tab } }
          : { to: it.to };
        return (
          <Link
            key={it.label}
            {...linkProps}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-primary text-white shadow-sm shadow-primary/30"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <it.icon className="h-4 w-4 shrink-0" /> {it.label}
          </Link>
        );
      })}
    </div>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <img
          src="/images/logos/fage-logo-white.webp"
          alt="FAGE"
          className="h-8 w-auto object-contain"
        />
        <div className="leading-tight">
          <div className="text-xs font-bold uppercase tracking-widest text-white/90">Member</div>
          <div className="text-[10px] text-white/40">Portal</div>
        </div>
      </div>

      <div className="mx-3 my-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {profile?.contact_name || "Member"}
            </div>
            <div className="truncate text-[11px] text-white/40">
              {profile?.member_id ?? user?.email ?? "ID pending"}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navList(TAB_ITEMS)}
        <div className="my-3 border-t border-white/10" />
        <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/30">
          Account
        </div>
        {navList(ACCOUNT_ITEMS)}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-all"
        >
          <Home className="h-4 w-4" /> View site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f5]">
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[#0f1a14] shadow-xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-3 rounded p-1 text-white/50 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0f1a14] lg:flex h-screen sticky top-0">
        {sidebar}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-accent lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">FAGE Member Portal</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm hover:bg-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {initials}
                </span>
                <span className="hidden max-w-[140px] truncate text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight">
                    {profile?.contact_name || "Member"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {profile?.email ?? user?.email}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <Link
                    to="/dashboard"
                    search={{ tab: "profile" } as any}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    onClick={() => setMenuOpen(false)}
                  >
                    <UserIcon className="h-4 w-4" /> View profile
                  </Link>
                  <Link
                    to="/account/security"
                    className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ShieldCheck className="h-4 w-4" /> Account & security
                  </Link>
                  <button
                    onClick={() =>
                      signOut().then(() => {
                        toast.success("You have been successfully signed out");
                        navigate({ to: "/login" });
                      })
                    }
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
