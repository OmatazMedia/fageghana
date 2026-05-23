import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  LogOut, Loader2, BadgeCheck, Calendar, CreditCard, FileDown, Bell, MessageCircle,
  Building2, Mail, Phone, MapPin, Briefcase, Upload, Send, X, Menu, ChevronDown, User as UserIcon, Home, Settings, Receipt, Banknote
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { initRenewalPayment } from "@/lib/payments.functions";
import { openPaystackInline } from "@/lib/paystackInline";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Member Dashboard — FAGE Ghana" }] }),
  component: Dashboard,
});

type Tab = "overview" | "subscription" | "certificate" | "notifications" | "support" | "profile";

const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    if ((user.user_metadata as any)?.must_change_password) {
      navigate({ to: "/account/change-password" });
    }
  }, [loading, user, navigate]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("member_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) {
      const { data: created } = await supabase.from("member_profiles").insert({
        user_id: user.id, email: user.email ?? "", company_name: "", contact_name: "",
      }).select("*").single();
      setProfile(created);
    } else {
      setProfile(data);
    }
    setBusy(false);
  }, [user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("notifications")
      .select("id", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .is("read_at", null)
      .then(({ count }) => setUnread(count ?? 0));
  }, [user, tab]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (loading || busy || !profile) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const tabs: Array<{ id: Tab; label: string; icon: any; badge?: number }> = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "certificate", label: "Certificate", icon: FileDown },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unread },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: Settings },
  ];

  const initials = (profile.contact_name || profile.email || "U")
    .split(" ").map((s: string) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const expired = expiry ? expiry.getTime() < Date.now() : true;
  const statusBadge = !expiry ? { label: "Inactive", cls: "bg-muted text-muted-foreground" }
    : expired ? { label: "Expired", cls: "bg-destructive/10 text-destructive" }
    : { label: "Active", cls: "bg-emerald-100 text-emerald-700" };

  function selectTab(t: Tab) { setTab(t); setSidebarOpen(false); }

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* Logo — matches admin */}
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
      {/* Member card */}
      <div className="mx-3 my-3 rounded-xl bg-white/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{profile.contact_name || "Member"}</div>
            <div className="truncate text-[11px] text-white/40">{profile.member_id ?? "ID pending"}</div>
          </div>
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {tabs.map(t => (
          <button key={t.id} onClick={() => selectTab(t.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-primary text-white shadow-sm shadow-primary/30"
                : "text-white/60 hover:bg-white/8 hover:text-white"
            }`}>
            <span className="flex items-center gap-3"><t.icon className="h-4 w-4 shrink-0" /> {t.label}</span>
            {!!t.badge && t.badge > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                tab === t.id ? "bg-white text-primary" : "bg-primary text-white"
              }`}>{t.badge}</span>
            )}
          </button>
        ))}
      </nav>
      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link to="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all">
          <Home className="h-4 w-4" /> View site
        </Link>
        <button onClick={() => signOut().then(() => navigate({ to: "/" }))}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f5]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-[#0f1a14] shadow-xl">
            <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-3 rounded p-1 text-white/50 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0f1a14] lg:flex h-screen sticky top-0">
        {sidebar}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 hover:bg-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/images/logos/fage-logo-main.webp" alt="FAGE" className="h-7 w-auto" />
            <span className="font-bold text-sm">Member Portal</span>
          </div>
          {/* Desktop breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">FAGE Member Portal</span>
            <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
            <span className="capitalize text-foreground">{tab}</span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => selectTab("notifications")} className="relative rounded-lg p-2 hover:bg-accent" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread > 9 ? "9+" : unread}</span>
              )}
            </button>
            <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${statusBadge.cls}`}>{statusBadge.label}</span>
            <div ref={menuRef} className="relative">
              <button onClick={() => setMenuOpen(o => !o)} className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm hover:bg-accent">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
                <span className="hidden max-w-[140px] truncate text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight">{profile.contact_name || "Member"}</span>
                  <span className="block text-[10px] text-muted-foreground">{profile.email}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <div className="border-b border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initials}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{profile.contact_name || "Member"}</div>
                        <div className="truncate text-xs text-muted-foreground">{profile.email}</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-background p-2">
                        <div className="text-muted-foreground">Member ID</div>
                        <div className="truncate font-semibold">{profile.member_id ?? "Pending"}</div>
                      </div>
                      <div className="rounded-lg bg-background p-2">
                        <div className="text-muted-foreground">Tier</div>
                        <div className="truncate font-semibold capitalize">{profile.tier}</div>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { setMenuOpen(false); selectTab("profile"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
                    <UserIcon className="h-4 w-4" /> View profile
                  </button>
                  <button onClick={() => { setMenuOpen(false); selectTab("subscription"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent">
                    <CreditCard className="h-4 w-4" /> Subscription
                  </button>
                  <Link to="/" className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent" onClick={() => setMenuOpen(false)}>
                    <Home className="h-4 w-4" /> Back to website
                  </Link>
                  <button onClick={() => signOut().then(() => navigate({ to: "/" }))}
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {tab === "overview" && <OverviewTab profile={profile} userId={user!.id} />}
          {tab === "subscription" && <SubscriptionTab profile={profile} userId={user!.id} onChange={loadProfile} />}
          {tab === "certificate" && <CertificateTab userId={user!.id} />}
          {tab === "notifications" && <NotificationsTab userId={user!.id} />}
          {tab === "support" && <SupportTab userId={user!.id} />}
          {tab === "profile" && <ProfileTab profile={profile} onSaved={loadProfile} />}
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, hint }: any) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function OverviewTab({ profile, userId }: { profile: any; userId: string }) {
  const [counts, setCounts] = useState({ apps: 0, payments: 0, certs: 0, notif: 0, tickets: 0 });
  useEffect(() => {
    void (async () => {
      const [a, p, c, n, t] = await Promise.all([
        supabase.from("membership_applications").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("payment_submissions").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("revoked", false),
        supabase.from("notifications").select("id", { count: "exact", head: true }).or(`user_id.eq.${userId},user_id.is.null`).is("read_at", null),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "closed"),
      ]);
      setCounts({ apps: a.count ?? 0, payments: p.count ?? 0, certs: c.count ?? 0, notif: n.count ?? 0, tickets: t.count ?? 0 });
    })();
  }, [userId]);

  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const showRenewBanner = daysLeft === null || daysLeft <= 60;
  const urgent = daysLeft !== null && daysLeft <= 14;
  return (
    <div>
      <h1 className="text-3xl font-bold">Welcome{profile.contact_name ? `, ${profile.contact_name}` : ""} 👋</h1>
      <p className="mt-1 text-muted-foreground">Your membership at a glance.</p>
      {showRenewBanner && (
        <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ${expired ? "bg-destructive/10 text-destructive" : urgent ? "bg-amber-100 text-amber-900" : "bg-accent"}`}>
          <div>
            <p className="font-semibold">{expired ? "Your membership has expired" : daysLeft === null ? "Activate your membership" : `Your membership expires in ${daysLeft} days`}</p>
            <p className="text-sm opacity-80">{expired ? "Renew now to restore your benefits and certificate." : "Renew now to keep your member ID, certificate and benefits active."}</p>
          </div>
          <a href={profile.tier ? `/apply/${profile.tier}` : "/membership"} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Renew membership</a>
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<BadgeCheck className="h-5 w-5" />} label="Member ID" value={profile.member_id ?? "Pending"} hint={profile.member_id ? null : "Issued after first payment"} />
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Tier" value={<span className="capitalize">{profile.tier}</span>} />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Expiry"
          value={expiry ? expiry.toLocaleDateString() : "Not active"}
          hint={daysLeft === null ? "Renew to activate" : expired ? "Subscription expired" : `${daysLeft} days remaining`}
        />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Status" value={
          <span className={`rounded-full px-2 py-0.5 text-xs ${!expiry || expired ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"}`}>
            {!expiry ? "Inactive" : expired ? "Expired" : "Active"}
          </span>
        } />
      </div>

      <h2 className="mt-10 text-lg font-bold">Activity overview</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon={<Building2 className="h-5 w-5" />} label="Applications" value={counts.apps} />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Payments" value={counts.payments} />
        <StatCard icon={<FileDown className="h-5 w-5" />} label="Certificates" value={counts.certs} />
        <StatCard icon={<Bell className="h-5 w-5" />} label="Unread alerts" value={counts.notif} />
        <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Open tickets" value={counts.tickets} />
      </div>
    </div>
  );
}

function SubscriptionTab({ profile, userId, onChange }: { profile: any; userId: string; onChange: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [renewOpen, setRenewOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [pickGatewayFor, setPickGatewayFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const initRenew = useServerFn(initRenewalPayment);

  const refresh = useCallback(async () => {
    const [p, g, s] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("active", true).order("display_order"),
      supabase.rpc("list_enabled_gateways" as any),
      supabase.from("payment_submissions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    const gateways = (g.data ?? []).map((row: any) => ({ ...row, config: { public_key: row.public_key } }));
    const gwMap = new Map(gateways.map((gw: any) => [gw.id, gw]));
    const submissions = (s.data ?? []).map((sub: any) => ({
      ...sub,
      payment_gateways: sub.gateway_id ? (gwMap.get(sub.gateway_id) ?? null) : null,
    }));
    setPlans(p.data ?? []);
    setGateways(gateways);
    setSubmissions(submissions);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const myPlan = plans.find(p => p.tier === profile.tier);
  const onlineGateways = gateways.filter(g => g.provider !== "manual_bank");
  const manualGateways = gateways.filter(g => g.provider === "manual_bank");
  const singleOnline = onlineGateways.length === 1 ? onlineGateways[0] : null;

  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const expired = expiry ? expiry.getTime() < Date.now() : true;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;

  async function payWithGateway(planId: string, gatewayId: string) {
    setBusy(true);
    try {
      const payment = await initRenew({ data: { plan_id: planId, gateway_id: gatewayId } });
      if ("mode" in payment && payment.mode === "paystack_inline") {
        await openPaystackInline(payment, () => setBusy(false));
        return;
      }
      window.location.href = payment.redirect_url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start payment");
      setBusy(false);
    }
  }

  function choosePlan(planId: string) {
    setSelectedPlanId(planId);
    if (singleOnline && manualGateways.length === 0) {
      void payWithGateway(planId, singleOnline.id);
      return;
    }
    setPickGatewayFor(planId);
  }

  return (
    <div className="space-y-6">
      {/* Active subscription card */}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Your subscription</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Member ID</div><div className="font-semibold">{profile.member_id ?? "Pending"}</div></div>
              <div><div className="text-xs text-muted-foreground">Tier</div><div className="font-semibold capitalize">{profile.tier}</div></div>
              <div><div className="text-xs text-muted-foreground">Plan</div><div className="font-semibold">{myPlan ? `${myPlan.currency} ${Number(myPlan.amount).toLocaleString()}` : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Status</div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${!expiry || expired ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"}`}>
                  {!expiry ? "Inactive" : expired ? "Expired" : "Active"}
                </span>
              </div>
              <div><div className="text-xs text-muted-foreground">Started</div><div className="font-semibold">{profile.subscription_start ? new Date(profile.subscription_start).toLocaleDateString() : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Expires</div><div className="font-semibold">{expiry ? expiry.toLocaleDateString() : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Days left</div><div className="font-semibold">{daysLeft === null ? "—" : daysLeft < 0 ? "Expired" : `${daysLeft}`}</div></div>
              <div><div className="text-xs text-muted-foreground">Duration</div><div className="font-semibold">{myPlan ? `${myPlan.duration_months} months` : "—"}</div></div>
            </div>
          </div>
          <button onClick={() => setRenewOpen(true)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            {profile.subscription_expiry ? "Renew membership" : "Activate membership"}
          </button>
        </div>
      </div>

      {/* Payment history */}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold">Payment history</h3>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="font-semibold">{s.currency} {Number(s.amount).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">via {s.payment_gateways?.name ?? s.method}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} · Ref: {s.reference || "—"}</div>
                  {s.admin_notes && <div className="mt-1 text-xs"><span className="font-semibold">Admin:</span> {s.admin_notes}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${s.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : s.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>{s.status}</span>
                  {s.status === "confirmed" && (
                    <Link to="/receipt/$id" params={{ id: s.id }} className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground">
                      <Receipt className="h-3 w-3" /> Receipt
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Renew modal — pick a plan */}
      {renewOpen && !pickGatewayFor && (
        <Modal onClose={() => setRenewOpen(false)} title="Choose a membership plan">
          <p className="mb-4 text-sm text-muted-foreground">
            Renew on your current plan to extend your expiry, or upgrade/downgrade — your member ID will update to match the new plan.
          </p>
          <div className="space-y-3">
            {plans.length === 0 && <p className="text-sm text-muted-foreground">No plans available right now.</p>}
            {plans.map(p => {
              const isCurrent = p.tier === profile.tier;
              return (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => choosePlan(p.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition hover:border-primary disabled:opacity-60 ${isCurrent ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold capitalize">{p.name ?? p.tier}</div>
                      {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">Your current plan</span>}
                    </div>
                    {p.description && <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>}
                    <div className="mt-1 text-xs text-muted-foreground">{p.duration_months} months</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{p.currency} {Number(p.amount).toLocaleString()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Gateway picker (only when more than one gateway exists) */}
      {pickGatewayFor && (
        <Modal onClose={() => { setPickGatewayFor(null); setRenewOpen(true); }} title="Choose payment method">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onlineGateways.map(g => (
              <button key={g.id} disabled={busy} onClick={() => payWithGateway(pickGatewayFor, g.id)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60">
                <CreditCard className="h-5 w-5 text-primary" />
                <div><div className="font-semibold">{g.name}</div><div className="text-xs capitalize text-muted-foreground">Pay online via {g.provider}</div></div>
              </button>
            ))}
            {manualGateways.map(g => (
              <button key={g.id} disabled={busy} onClick={() => payWithGateway(pickGatewayFor, g.id)} className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60">
                <Banknote className="h-5 w-5 text-primary" />
                <div><div className="font-semibold">{g.name}</div><div className="text-xs text-muted-foreground">Manual bank deposit</div></div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CertificateTab({ userId }: { userId: string }) {
  const [certs, setCerts] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("certificates").select("*").eq("user_id", userId).order("issued_at", { ascending: false })
      .then(({ data }) => setCerts(data ?? []));
  }, [userId]);

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Your certificates</h2>
      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <FileDown className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No certificate yet. Once admin confirms your payment, your certificate will appear here for download.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certs.map(c => {
            const valid = !c.revoked && new Date(c.expires_at) > new Date();
            return (
              <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">ID: {c.member_id} · <span className="capitalize">{c.tier}</span></div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${valid ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>{valid ? "Active" : c.revoked ? "Revoked" : "Expired"}</span>
                </div>
                <div className="p-4 text-xs text-muted-foreground">
                  <div>Issued: {new Date(c.issued_at).toLocaleDateString()}</div>
                  <div>Expires: {new Date(c.expires_at).toLocaleDateString()}</div>
                  <div className="mt-1 break-all">Code: <span className="font-mono">{c.verification_code}</span></div>
                </div>
                <div className="flex border-t border-border">
                  <Link to="/certificate/$id" params={{ id: c.id }} className="flex-1 bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground">View & download</Link>
                  <Link to="/verify/$code" params={{ code: c.verification_code }} className="flex-1 py-2.5 text-center text-xs font-semibold hover:bg-accent">Verify page</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NotificationsTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    void supabase.from("notifications").select("*").or(`user_id.eq.${userId},user_id.is.null`).order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, [userId]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems(items.map(i => i.id === id ? { ...i, read_at: new Date().toISOString() } : i));
  }

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Notifications</h2>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">No notifications.</p> : (
        <div className="space-y-3">
          {items.map(n => (
            <div key={n.id} className={`rounded-lg border p-4 ${n.read_at ? "border-border" : "border-primary bg-primary/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{n.title}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.read_at && n.user_id === userId && (
                  <button onClick={() => markRead(n.id)} className="text-xs text-primary hover:underline">Mark read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SupportTab({ userId }: { userId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [reply, setReply] = useState("");

  const loadTickets = useCallback(async () => {
    const { data } = await supabase.from("support_tickets").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }, [userId]);

  useEffect(() => { void loadTickets(); }, [loadTickets]);

  async function openTicket(t: any) {
    setActive(t);
    const { data } = await supabase.from("ticket_messages").select("*").eq("ticket_id", t.id).order("created_at");
    setMessages(data ?? []);
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    const { data: t, error } = await supabase.from("support_tickets").insert({ user_id: userId, subject: newSubject }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("ticket_messages").insert({ ticket_id: t.id, sender_id: userId, body: newBody, is_admin: false });
    setNewSubject(""); setNewBody("");
    toast.success("Ticket opened");
    await loadTickets();
    void openTicket(t);
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    const { error } = await supabase.from("ticket_messages").insert({ ticket_id: active.id, sender_id: userId, body: reply, is_admin: false });
    if (error) return toast.error(error.message);
    await supabase.from("support_tickets").update({ status: "open", updated_at: new Date().toISOString() }).eq("id", active.id);
    setReply("");
    void openTicket(active);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-3 text-base font-bold">New ticket</h3>
          <form onSubmit={createTicket} className="space-y-3">
            <input className={inputCls} placeholder="Subject" value={newSubject} onChange={e => setNewSubject(e.target.value)} required />
            <textarea className={inputCls} rows={3} placeholder="Describe your issue…" value={newBody} onChange={e => setNewBody(e.target.value)} required />
            <button className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">Open ticket</button>
          </form>
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-3 text-base font-bold">Your tickets</h3>
          {tickets.length === 0 ? <p className="text-sm text-muted-foreground">No tickets yet.</p> : (
            <ul className="space-y-2">
              {tickets.map(t => (
                <li key={t.id}>
                  <button onClick={() => openTicket(t)} className={`w-full rounded-lg border p-3 text-left text-sm ${active?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{t.subject}</span>
                      <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleDateString()}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        {!active ? (
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">Select a ticket to view the conversation.</div>
        ) : (
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{active.subject}</h3>
                <span className="text-xs capitalize text-muted-foreground">{active.status}</span>
              </div>
              <button onClick={() => setActive(null)} className="text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {messages.map(m => (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.is_admin ? "bg-accent" : "bg-primary/10"}`}>
                  <div className="text-xs font-semibold text-muted-foreground">{m.is_admin ? "FAGE Admin" : "You"} · {new Date(m.created_at).toLocaleString()}</div>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            {active.status !== "closed" && (
              <div className="mt-4 flex gap-2">
                <textarea className={inputCls} rows={2} placeholder="Write a reply…" value={reply} onChange={e => setReply(e.target.value)} />
                <button onClick={sendReply} className="self-end rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileTab({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase.from("member_profiles").update({
      company_name: String(fd.get("company_name") ?? ""),
      contact_name: String(fd.get("contact_name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? "Ghana"),
      industry: String(fd.get("industry") ?? "") || null,
      products_exported: String(fd.get("products_exported") ?? "") || null,
      tier: String(fd.get("tier") ?? "associate") as any,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Profile saved"); onSaved(); }
  }
  return (
    <form onSubmit={save} className="rounded-2xl bg-card p-6 shadow-sm grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field icon={<Building2 className="h-4 w-4" />} label="Company name" name="company_name" defaultValue={profile.company_name} required />
      <Field label="Contact name" name="contact_name" defaultValue={profile.contact_name} required />
      <Field icon={<Mail className="h-4 w-4" />} label="Email" name="email" defaultValue={profile.email} disabled />
      <Field icon={<Phone className="h-4 w-4" />} label="Phone" name="phone" defaultValue={profile.phone} required />
      <Field icon={<MapPin className="h-4 w-4" />} label="Country" name="country" defaultValue={profile.country} required />
      <Field icon={<Briefcase className="h-4 w-4" />} label="Industry" name="industry" defaultValue={profile.industry ?? ""} />
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-sm font-medium">Products you export</label>
        <textarea name="products_exported" rows={2} defaultValue={profile.products_exported ?? ""} className={inputCls} />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-sm font-medium">Membership tier</label>
        <select name="tier" defaultValue={profile.tier} className={inputCls}>
          <option value="associate">Associate</option>
          <option value="standard">Standard</option>
          <option value="corporate">Corporate</option>
        </select>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button type="submit" disabled={saving} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? "Saving…" : "Save profile"}
        </button>
      </div>
    </form>
  );
}

function Field({ icon, label, name, defaultValue, required, disabled }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{icon} {label}</span>
      <input name={name} defaultValue={defaultValue} required={required} disabled={disabled}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60" />
    </label>
  );
}
