import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  LogOut,
  Loader2,
  BadgeCheck,
  Calendar,
  CreditCard,
  FileDown,
  Bell,
  MessageCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Upload,
  Send,
  X,
  Menu,
  ChevronDown,
  User as UserIcon,
  Home,
  Settings,
  Receipt,
  Banknote,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ExternalLink,
  Search,
  FolderOpen,
  FileText,
  Trash2,
  Download,
  MailCheck,
  CalendarDays,
  Users,
  Globe,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { initRenewalPayment } from "@/lib/payments.functions";
import { openPaystackInline } from "@/lib/paystackInline";
import { openFlutterwaveInline } from "@/lib/flutterwaveInline";
import { MyDirectoryListingTab } from "@/components/dashboard/MyDirectoryListingTab";
import { ResourcesTabDb } from "@/components/dashboard/ResourcesTabDb";
import { RenewalLockScreen } from "@/components/dashboard/RenewalLockScreen";

type Tab = "overview" | "subscription" | "certificate" | "notifications" | "support" | "profile" | "resources" | "readiness" | "documents" | "invoices" | "email-prefs" | "events" | "trade" | "directory" | "my-listing";

const VALID_TABS: Tab[] = ["overview","subscription","certificate","notifications","support","profile","resources","readiness","documents","invoices","email-prefs","events","trade","directory","my-listing"];

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Member Dashboard — FAGE Ghana" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const t = typeof search?.tab === "string" ? (search.tab as Tab) : "overview";
    return { tab: (VALID_TABS as string[]).includes(t) ? t : ("overview" as Tab) };
  },
  component: Dashboard,
});

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { tab: urlTab } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(urlTab);
  const [profile, setProfile] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [unread, setUnread] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sync tab → URL
  useEffect(() => {
    if (tab !== urlTab) {
      navigate({ to: "/dashboard", search: { tab }, replace: true });
    }
  }, [tab, urlTab, navigate]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
    else if (!loading && user && (user.user_metadata as any)?.must_change_password) {
      navigate({ to: "/account/change-password", replace: true });
    }
  }, [loading, user, navigate]);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("member_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) {
      const { data: created } = await supabase
        .from("member_profiles")
        .insert({
          user_id: user.id,
          email: user.email ?? "",
          company_name: "",
          contact_name: "",
        })
        .select("*")
        .single();
      setProfile(created);
    } else {
      setProfile(data);
    }
    setBusy(false);
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("notifications")
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
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const tabs: Array<{ id: Tab; label: string; icon: any; badge?: number }> = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "certificate", label: "Certificate", icon: FileDown },
    { id: "events", label: "Events", icon: CalendarDays },
    { id: "trade", label: "Trade Opportunities", icon: TrendingUp },
    { id: "directory", label: "Member Directory", icon: Users },
    { id: "my-listing", label: "My Directory Listing", icon: Building2 },
    { id: "readiness", label: "Readiness Score", icon: ShieldCheck },
    { id: "resources", label: "Resources", icon: BookOpen },
    { id: "documents", label: "My Documents", icon: FolderOpen },
    { id: "invoices", label: "Invoice History", icon: Receipt },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unread },
    { id: "email-prefs", label: "Email Preferences", icon: MailCheck },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: Settings },
  ];

  const initials = (profile.contact_name || profile.email || "U")
    .split(" ")
    .map((s: string) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const expired = expiry ? expiry.getTime() < Date.now() : true;
  const suspended = (profile as any).status === "suspended";
  const lockedReason: "expired" | "suspended" | "inactive" | null = suspended
    ? "suspended"
    : !expiry
      ? "inactive"
      : expired
        ? "expired"
        : null;
  const statusBadge = !expiry
    ? { label: "Inactive", cls: "bg-muted text-muted-foreground" }
    : expired
      ? { label: "Expired", cls: "bg-destructive/10 text-destructive" }
      : { label: "Active", cls: "bg-emerald-100 text-emerald-700" };

  function selectTab(t: Tab) {
    setTab(t);
    setSidebarOpen(false);
  }

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
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {profile.contact_name || "Member"}
            </div>
            <div className="truncate text-[11px] text-white/40">
              {profile.member_id ?? "ID pending"}
            </div>
          </div>
        </div>
      </div>
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => selectTab(t.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-primary text-white shadow-sm shadow-primary/30"
                : "text-white/60 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-3">
              <t.icon className="h-4 w-4 shrink-0" /> {t.label}
            </span>
            {!!t.badge && t.badge > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.id ? "bg-white text-primary" : "bg-primary text-white"
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      {/* Footer */}
      <div className="border-t border-white/10 p-3 space-y-0.5">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
        >
          <Home className="h-4 w-4" /> View site
        </Link>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/50 hover:bg-white/8 hover:text-white transition-all"
        >
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

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col bg-[#0f1a14] lg:flex h-screen sticky top-0">
        {sidebar}
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <header className="flex h-14 items-center justify-between border-b border-border bg-white px-4 lg:px-6 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-accent lg:hidden"
          >
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
            <button
              onClick={() => selectTab("notifications")}
              className="relative rounded-lg p-2 hover:bg-accent"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            <span
              className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${statusBadge.cls}`}
            >
              {statusBadge.label}
            </span>
            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 text-sm hover:bg-accent"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </span>
                <span className="hidden max-w-[140px] truncate text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight">
                    {profile.contact_name || "Member"}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">{profile.email}</span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <div className="border-b border-border bg-muted/30 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {profile.contact_name || "Member"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {profile.email}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-background p-2">
                        <div className="text-muted-foreground">Member ID</div>
                        <div className="truncate font-semibold">
                          {profile.member_id ?? "Pending"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-background p-2">
                        <div className="text-muted-foreground">Tier</div>
                        <div className="truncate font-semibold capitalize">{profile.tier}</div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      selectTab("profile");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                  >
                    <UserIcon className="h-4 w-4" /> View profile
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      selectTab("subscription");
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                  >
                    <CreditCard className="h-4 w-4" /> Subscription
                  </button>
                  <Link
                    to="/account/security"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    onClick={() => setMenuOpen(false)}
                  >
                    <ShieldCheck className="h-4 w-4" /> Account & security
                  </Link>
                  <Link
                    to="/"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-accent"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Home className="h-4 w-4" /> Back to website
                  </Link>
                  <button
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {lockedReason && tab === "support" ? (
            <SupportTab userId={user!.id} />
          ) : lockedReason ? (
            <RenewalLockScreen
              reason={lockedReason}
              expiryDate={profile.subscription_expiry ?? null}
              tier={profile.tier ?? null}
              userId={user!.id}
              email={profile.email ?? user!.email ?? ""}
              onActivated={loadProfile}
              onSignOut={() => void signOut()}
            />
          ) : (
            <>
              {tab === "overview" && (
                <OverviewTab
                  profile={profile}
                  userId={user!.id}
                  onRenew={() => setTab("subscription")}
                />
              )}
              {tab === "subscription" && (
                <SubscriptionTab profile={profile} userId={user!.id} onChange={loadProfile} />
              )}
              {tab === "certificate" && <CertificateTab userId={user!.id} />}
              {tab === "events" && <EventsTab userId={user!.id} />}
              {tab === "trade" && <TradeTab userId={user!.id} />}
              {tab === "directory" && <DirectoryTab />}
              {tab === "my-listing" && (
                <MyDirectoryListingTab
                  userId={user!.id}
                  subscriptionActive={
                    !!profile.subscription_expiry &&
                    new Date(profile.subscription_expiry).getTime() > Date.now()
                  }
                />
              )}
              {tab === "readiness" && <ReadinessTab userId={user!.id} />}
              {tab === "resources" && <ResourcesTabDb tier={profile.tier} />}
              {tab === "documents" && <DocumentsTab userId={user!.id} />}
              {tab === "invoices" && <InvoicesTab userId={user!.id} profile={profile} />}
              {tab === "email-prefs" && <EmailPrefsTab userId={user!.id} email={profile.email} />}
              {tab === "notifications" && <NotificationsTab userId={user!.id} />}
              {tab === "support" && <SupportTab userId={user!.id} />}
              {tab === "profile" && <ProfileTab profile={profile} onSaved={loadProfile} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Email Preferences
───────────────────────────────────────────────────────────────────────── */
const EMAIL_PREFS_META = [
  {
    key: "newsletters",
    label: "Newsletter & Updates",
    desc: "Monthly FAGE newsletter, export news and industry updates.",
  },
  {
    key: "event_alerts",
    label: "Event & Activity Alerts",
    desc: "Notifications about upcoming trade fairs, workshops and missions.",
  },
  {
    key: "trade_notices",
    label: "Trade Opportunity Notices",
    desc: "New buyer leads, RFQs and export tender opportunities.",
  },
  {
    key: "payment_reminders",
    label: "Payment & Renewal Reminders",
    desc: "Reminders when your membership is due for renewal or payment is pending.",
  },
] as const;

type PrefKey = (typeof EMAIL_PREFS_META)[number]["key"];

function EmailPrefsTab({ userId, email }: { userId: string; email: string }) {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    newsletters: true,
    event_alerts: true,
    trade_notices: true,
    payment_reminders: true,
  });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase
      .from("member_email_preferences" as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          setPrefs({
            newsletters: data.newsletters ?? true,
            event_alerts: data.event_alerts ?? true,
            trade_notices: data.trade_notices ?? true,
            payment_reminders: data.payment_reminders ?? true,
          });
        }
        setLoaded(true);
      });
  }, [userId]);

  async function save() {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-email-preferences", {
        body: { user_id: userId, ...prefs },
      });
      if (error) throw error;
      setPrefs(data.updated);
      toast.success("Email preferences saved.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">Email Preferences</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which emails you receive at{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>

        <div className="mt-6 space-y-4">
          {EMAIL_PREFS_META.map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border p-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold">{label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
              </div>
              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={prefs[key]}
                onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
                  prefs[key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                    prefs[key] ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-accent/50 p-4">
          <p className="text-xs text-muted-foreground">
            Transactional emails (payment confirmations, certificate issuance) are always sent
            regardless of these settings.
          </p>
          <button
            onClick={save}
            disabled={saving}
            className="shrink-0 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   My Documents
───────────────────────────────────────────────────────────────────────── */
const DOC_TYPES = [
  { value: "business_reg",   label: "Business Registration" },
  { value: "export_licence", label: "Export Licence" },
  { value: "tax_clearance",  label: "Tax Clearance Certificate" },
  { value: "other",          label: "Other" },
];

function DocumentsTab({ userId }: { userId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("business_reg");
  const [docName, setDocName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("member_documents")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });
    setDocs(data ?? []);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file || !docName.trim()) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("member-documents")
      .upload(path, file, { upsert: false });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error: dbErr } = await supabase.from("member_documents").insert({
      user_id: userId,
      name: docName.trim(),
      doc_type: docType,
      file_path: path,
      file_size: file.size,
    });
    if (dbErr) { toast.error(dbErr.message); setUploading(false); return; }
    toast.success("Document uploaded");
    setDocName("");
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    void load();
  }

  async function remove(doc: any) {
    await supabase.storage.from("member-documents").remove([doc.file_path]);
    await supabase.from("member_documents").delete().eq("id", doc.id);
    toast.success("Document removed");
    void load();
  }

  async function download(doc: any) {
    const { data } = await supabase.storage
      .from("member-documents")
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const typeLabel = (v: string) => DOC_TYPES.find((d) => d.value === v)?.label ?? v;
  const fmtSize = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">My Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">Upload and manage your export-related documents securely.</p>
        <form onSubmit={upload} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium">Document name</label>
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. Business Registration 2024"
              required
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className={inputCls}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">File (PDF or image)</label>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" required className={inputCls} />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload document"}
            </button>
          </div>
        </form>
      </div>

      {/* Document list */}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold">Uploaded documents ({docs.length})</h3>
        {docs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{doc.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {typeLabel(doc.doc_type)}
                      {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ""}
                      {" · "}{new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => download(doc)} className="flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground">
                    <Download className="h-3 w-3" /> View
                  </button>
                  <button onClick={() => remove(doc)} className="rounded-full border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Invoice History
───────────────────────────────────────────────────────────────────────── */
function InvoicesTab({ userId, profile }: { userId: string; profile: any }) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    void supabase
      .from("member_invoices" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setInvoices(data ?? []); setBusy(false); });
  }, [userId]);

  function printInvoice(inv: any) {
    const html = `
<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Invoice ${inv.reference ?? inv.id.slice(0, 8)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; margin: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
  .logo { font-size: 22px; font-weight: 800; color: #2d7a4f; }
  .sub { font-size: 11px; color: #666; margin-top: 2px; }
  h2 { font-size: 18px; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #f4f4f4; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  .total { font-size: 16px; font-weight: 700; text-align: right; margin-top: 16px; }
  .badge { display: inline-block; background: #d1fae5; color: #065f46; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 600; }
  .footer { margin-top: 48px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 16px; }
</style></head><body>
<div class="header">
  <div><div class="logo">FAGE Ghana</div><div class="sub">Federation of Associations of Ghanaian Exporters<br>Number 22, Nii Tsatse Dzani Street, Adjiringanor, Accra<br>info@fageghana.com</div></div>
  <div style="text-align:right"><h2>INVOICE</h2><div class="sub">Ref: ${inv.reference ?? inv.id.slice(0, 8).toUpperCase()}<br>Date: ${new Date(inv.confirmed_at ?? inv.created_at).toLocaleDateString()}</div></div>
</div>
<table><thead><tr><th>Bill To</th><th>Member ID</th><th>Tier</th></tr></thead>
<tbody><tr><td>${inv.company_name ?? ""}<br><span style="color:#666">${inv.contact_name ?? ""}</span></td><td>${inv.member_id ?? "Pending"}</td><td style="text-transform:capitalize">${inv.tier ?? ""}</td></tr></tbody></table>
<table style="margin-top:24px"><thead><tr><th>Description</th><th>Duration</th><th>Method</th><th>Amount</th></tr></thead>
<tbody><tr><td>FAGE Membership Subscription</td><td>${inv.duration_months} month${inv.duration_months !== 1 ? "s" : ""}</td><td>${inv.gateway_name ?? inv.method}</td><td>${inv.currency} ${Number(inv.amount).toLocaleString()}</td></tr></tbody></table>
<div class="total">Total: ${inv.currency} ${Number(inv.amount).toLocaleString()} <span class="badge">Confirmed</span></div>
<div class="footer">Thank you for your membership. This is an official receipt from FAGE Ghana.</div>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <h2 className="mb-1 text-xl font-bold">Invoice History</h2>
      <p className="mb-5 text-sm text-muted-foreground">All confirmed payments with printable invoices.</p>
      {busy ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No confirmed payments yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {inv.currency} {Number(inv.amount).toLocaleString()}
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Confirmed</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(inv.confirmed_at ?? inv.created_at).toLocaleDateString()}
                    {" · "}{inv.duration_months} month{inv.duration_months !== 1 ? "s" : ""}
                    {" · "}{inv.gateway_name ?? inv.method}
                    {inv.reference ? ` · Ref: ${inv.reference}` : ""}
                  </div>
                </div>
              </div>
              <button
                onClick={() => printInvoice(inv)}
                className="flex items-center gap-1.5 rounded-full border border-primary px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Download className="h-3.5 w-3.5" /> Print / Save PDF
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Export Readiness Score
───────────────────────────────────────────────────────────────────────── */
function ReadinessTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [docs, setDocs] = useState<any[]>([]);
  const [score, setScore] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [itemsRes, respRes, docsRes, scoreRes] = await Promise.all([
      supabase.from("readiness_checklist_items").select("*").eq("active", true).order("display_order"),
      supabase.from("member_readiness_responses").select("*").eq("user_id", userId),
      supabase.from("member_documents").select("id,name,doc_type").eq("user_id", userId).order("uploaded_at", { ascending: false }),
      supabase.rpc("get_readiness_score", { _user_id: userId }),
    ]);
    setItems(itemsRes.data ?? []);
    const map: Record<string, any> = {};
    (respRes.data ?? []).forEach((r: any) => { map[r.item_id] = r; });
    setResponses(map);
    setDocs(docsRes.data ?? []);
    setScore(Number(scoreRes.data ?? 0));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function update(itemId: string, patch: { status?: string; evidence_doc_id?: string | null; notes?: string }) {
    const existing = responses[itemId];
    const row = {
      user_id: userId,
      item_id: itemId,
      status: patch.status ?? existing?.status ?? "not_started",
      evidence_doc_id: patch.evidence_doc_id !== undefined ? patch.evidence_doc_id : existing?.evidence_doc_id ?? null,
      notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? null,
    };
    const { error } = await supabase
      .from("member_readiness_responses")
      .upsert(row, { onConflict: "user_id,item_id" });
    if (error) { toast.error(error.message); return; }
    setResponses((p) => ({ ...p, [itemId]: { ...row } }));
    const { data: s } = await supabase.rpc("get_readiness_score", { _user_id: userId });
    setScore(Number(s ?? 0));
  }

  const grouped = items.reduce<Record<string, any[]>>((acc, it) => {
    (acc[it.category] ||= []).push(it);
    return acc;
  }, {});

  const color = score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-destructive";
  const ring = score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-destructive";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  if (loading) return <p className="text-muted-foreground">Loading readiness checklist…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">Export Readiness Score</h2>
        <p className="mt-1 text-sm text-muted-foreground">Mark each item as you progress. Attach supporting documents from your uploads as evidence.</p>
        <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
            <svg className="-rotate-90" width="128" height="128" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-border)" strokeWidth="10" />
              <circle cx="50" cy="50" r="40" fill="none" className={ring} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            </svg>
            <div className="absolute text-center">
              <div className={`text-2xl font-bold ${color}`}>{score}%</div>
              <div className="text-[10px] text-muted-foreground">ready</div>
            </div>
          </div>
          <div className="flex-1">
            <p className={`text-lg font-semibold ${color}`}>
              {score >= 100 ? "🎉 Fully export-ready" : score >= 80 ? "Almost there!" : score >= 50 ? "Good progress" : "Just getting started"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Weighted across {items.length} checklist items. Items marked “In progress” count for half.
            </p>
          </div>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold">{cat}</h3>
          <ul className="space-y-4">
            {list.map((it) => {
              const r = responses[it.id];
              const status = r?.status ?? "not_started";
              return (
                <li key={it.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {status === "complete"
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          : status === "in_progress"
                            ? <Circle className="h-5 w-5 text-amber-500" />
                            : <Circle className="h-5 w-5 text-muted-foreground" />}
                        <span className="font-medium text-sm">{it.label}</span>
                      </div>
                      {it.description && <p className="mt-1 text-xs text-muted-foreground pl-7">{it.description}</p>}
                    </div>
                    <select
                      value={status}
                      onChange={(e) => update(it.id, { status: e.target.value })}
                      className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs"
                    >
                      <option value="not_started">Not started</option>
                      <option value="in_progress">In progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 pl-7">
                    <select
                      value={r?.evidence_doc_id ?? ""}
                      onChange={(e) => update(it.id, { evidence_doc_id: e.target.value || null })}
                      className={inputCls}
                    >
                      <option value="">No evidence document</option>
                      {docs.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Notes (optional)"
                      defaultValue={r?.notes ?? ""}
                      onBlur={(e) => {
                        if ((e.target.value || "") !== (r?.notes || "")) {
                          void update(it.id, { notes: e.target.value || "" });
                        }
                      }}
                      className={inputCls}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Events & RSVPs
───────────────────────────────────────────────────────────────────────── */
function EventsTab({ userId }: { userId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [evRes, rRes] = await Promise.all([
      supabase.from("activities").select("*").eq("published", true).order("event_date", { ascending: true, nullsFirst: false }),
      supabase.from("event_rsvps").select("activity_id").eq("user_id", userId),
    ]);
    setEvents(evRes.data ?? []);
    setRsvps(new Set((rRes.data ?? []).map((r: any) => r.activity_id)));
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function rsvp(activityId: string) {
    const { error } = await supabase.from("event_rsvps").insert({ user_id: userId, activity_id: activityId });
    if (error) toast.error(error.message);
    else { toast.success("You're attending"); setRsvps((s) => new Set(s).add(activityId)); }
  }
  async function cancel(activityId: string) {
    const { error } = await supabase.from("event_rsvps").delete().eq("user_id", userId).eq("activity_id", activityId);
    if (error) toast.error(error.message);
    else { toast.success("RSVP cancelled"); setRsvps((s) => { const n = new Set(s); n.delete(activityId); return n; }); }
  }

  if (loading) return <p className="text-muted-foreground">Loading events…</p>;

  const now = Date.now();
  const upcoming = events.filter((e) => !e.event_date || new Date(e.event_date).getTime() >= now);
  const myEvents = events.filter((e) => rsvps.has(e.id));

  return (
    <div className="space-y-6">
      {myEvents.length > 0 && (
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold">Events I'm Attending ({myEvents.length})</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {myEvents.map((e) => <EventCard key={e.id} event={e} attending onRsvp={() => cancel(e.id)} />)}
          </div>
        </div>
      )}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">Upcoming Events & Activities</h2>
        <p className="mt-1 text-sm text-muted-foreground">RSVP to receive reminders and let organisers know you're coming.</p>
        {upcoming.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No upcoming events right now. Check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} attending={rsvps.has(e.id)} onRsvp={() => rsvps.has(e.id) ? cancel(e.id) : rsvp(e.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, attending, onRsvp }: { event: any; attending: boolean; onRsvp: () => void }) {
  const date = event.event_date ? new Date(event.event_date) : null;
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">{event.category}</div>
          <h4 className="mt-1 font-semibold leading-tight">{event.title}</h4>
        </div>
        {attending && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Going</span>}
      </div>
      {date && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </div>
      )}
      {event.location && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {event.location}
        </div>
      )}
      {event.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{event.description}</p>}
      <button
        onClick={onRsvp}
        className={`mt-3 w-full rounded-full px-3 py-1.5 text-xs font-semibold ${attending ? "border border-input bg-background hover:bg-muted" : "bg-primary text-primary-foreground"}`}
      >
        {attending ? "Cancel RSVP" : "RSVP"}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Trade Opportunities
───────────────────────────────────────────────────────────────────────── */
function TradeTab({ userId }: { userId: string }) {
  const [ops, setOps] = useState<any[]>([]);
  const [interests, setInterests] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [country, setCountry] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [oRes, iRes] = await Promise.all([
      supabase.from("trade_opportunities").select("*").eq("is_active", true).order("posted_at", { ascending: false }),
      supabase.from("trade_opportunity_interests").select("*").eq("user_id", userId),
    ]);
    setOps(oRes.data ?? []);
    const m: Record<string, any> = {};
    (iRes.data ?? []).forEach((r: any) => { m[r.opportunity_id] = r; });
    setInterests(m);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function submitInterest() {
    if (!open) return;
    const { error, data } = await supabase
      .from("trade_opportunity_interests")
      .insert({ user_id: userId, opportunity_id: open.id, message: message || null })
      .select()
      .single();
    if (error) toast.error(error.message);
    else {
      toast.success("Interest recorded — the FAGE team will follow up");
      setInterests((p) => ({ ...p, [open.id]: data }));
      setOpen(null); setMessage("");
    }
  }
  async function withdraw(opportunityId: string) {
    const { error } = await supabase.from("trade_opportunity_interests").delete().eq("user_id", userId).eq("opportunity_id", opportunityId);
    if (error) toast.error(error.message);
    else { toast.success("Withdrawn"); setInterests((p) => { const n = { ...p }; delete n[opportunityId]; return n; }); }
  }

  const countries = Array.from(new Set(ops.map((o) => o.country).filter(Boolean))).sort();
  const filtered = ops.filter((o) => {
    const term = q.trim().toLowerCase();
    const matchesQ = !term || [o.title, o.description, o.category].some((v) => (v ?? "").toLowerCase().includes(term));
    const matchesC = !country || o.country === country;
    return matchesQ && matchesC;
  });

  if (loading) return <p className="text-muted-foreground">Loading trade opportunities…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">Trade Opportunities</h2>
        <p className="mt-1 text-sm text-muted-foreground">Buyer leads, RFQs and export tenders curated for FAGE members.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search opportunities…" className={`${inputCls} pl-9`} />
          </div>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} style={{ maxWidth: 200 }}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-sm">No opportunities match your filters.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((o) => {
            const i = interests[o.id];
            return (
              <div key={o.id} className="rounded-2xl bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    {o.category && <div className="text-xs font-semibold uppercase tracking-wide text-primary">{o.category}</div>}
                    <h4 className="mt-1 font-semibold leading-tight">{o.title}</h4>
                  </div>
                  {o.deadline && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      Due {new Date(o.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {o.country && <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {o.country}</span>}
                  {o.source && <span>Source: {o.source}</span>}
                </div>
                {o.description && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{o.description}</p>}
                <div className="mt-4 flex items-center justify-between gap-2">
                  {o.source_url && (
                    <a href={o.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      View source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {i ? (
                    <button onClick={() => withdraw(o.id)} className="ml-auto rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                      Withdraw interest
                    </button>
                  ) : (
                    <button onClick={() => { setOpen(o); setMessage(""); }} className="ml-auto rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      I'm Interested
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Express interest</h3>
            <p className="mt-1 text-sm text-muted-foreground">{open.title}</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Add a short message for the FAGE secretariat (optional)…"
              className={`${inputCls} mt-4`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setOpen(null)} className="rounded-full border border-input px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitInterest} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Member Directory
───────────────────────────────────────────────────────────────────────── */
function DirectoryTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "association" | "corporate">("all");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("directory_entries")
        .select(
          "id,slug,entry_type,company_name,short_description,products,category,phone,email,country,region,physical_address,logo_url,director_name,contact_name,featured",
        )
        .eq("published", true)
        .eq("status", "approved")
        .eq("is_active", true)
        .order("featured", { ascending: false })
        .order("company_name");
      if (error) toast.error(error.message);
      else setRows(data ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (type !== "all" && r.entry_type !== type) return false;
    const term = q.trim().toLowerCase();
    if (!term) return true;
    return [
      r.company_name,
      r.contact_name ?? "",
      r.director_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.category ?? "",
      r.country ?? "",
      (r.products ?? []).join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const counts = {
    total: rows.length,
    associations: rows.filter((r) => r.entry_type === "association").length,
    corporate: rows.filter((r) => r.entry_type === "corporate").length,
  };

  if (loading) return <p className="text-muted-foreground">Loading directory…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h2 className="text-xl font-bold">Member Directory</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse fellow FAGE members. Search by company name, email or phone number.
        </p>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company, email, phone, product…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${counts.total})`],
              ["association", `Associations (${counts.associations})`],
              ["corporate", `Corporate (${counts.corporate})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setType(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                type === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
          No entries match your search.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const isAssoc = e.entry_type === "association";
            const initials = (e.company_name || "?")
              .split(" ")
              .slice(0, 2)
              .map((s: string) => s[0])
              .join("")
              .toUpperCase();
            return (
              <Link
                key={e.id}
                to="/directory/$slug"
                params={{ slug: e.slug }}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  {e.logo_url ? (
                    <img
                      src={e.logo_url}
                      alt={`${e.company_name} logo`}
                      loading="lazy"
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-xl text-sm font-bold ${
                        isAssoc ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                      }`}
                    >
                      {initials}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isAssoc
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-500/10 text-emerald-700"
                        }`}
                      >
                        {isAssoc ? <Users className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                        {isAssoc ? "Association" : "Corporate"}
                      </span>
                      {e.featured && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                          Featured
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1 truncate text-base font-semibold leading-tight">
                      {e.company_name}
                    </h4>
                    {e.category && (
                      <p className="truncate text-xs text-muted-foreground">{e.category}</p>
                    )}
                  </div>
                </div>
                {e.short_description && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                    {e.short_description}
                  </p>
                )}
                {e.products && e.products.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {e.products.slice(0, 4).map((p: string) => (
                      <span
                        key={p}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {p}
                      </span>
                    ))}
                    {e.products.length > 4 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{e.products.length - 4}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                  {e.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {e.phone}
                    </p>
                  )}
                  {e.email && (
                    <p className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />{" "}
                      <span className="truncate">{e.email}</span>
                    </p>
                  )}
                  {(e.physical_address || e.country) && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">
                        {e.physical_address ?? e.country}
                      </span>
                    </p>
                  )}
                </div>
                <div className="mt-3 text-right">
                  <span className="text-xs font-semibold text-primary group-hover:underline">
                    View details →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Training & Resources
───────────────────────────────────────────────────────────────────────── */
const RESOURCES = [
  {
    category: "Export Guides",
    items: [
      { title: "Ghana Export Procedures Manual", desc: "Step-by-step guide to exporting from Ghana", url: "https://www.gepa.gov.gh", type: "link" },
      { title: "Non-Traditional Exports Handbook", desc: "FAGE guide for NTE product categories", url: "https://www.fageghana.com", type: "link" },
      { title: "Phytosanitary Certificate Guide", desc: "How to obtain plant health certificates for export", url: "https://www.mofad.gov.gh", type: "link" },
    ],
  },
  {
    category: "Market Intelligence",
    items: [
      { title: "ITC Trade Map", desc: "Global trade statistics and market analysis tool", url: "https://www.trademap.org", type: "link" },
      { title: "EU Market Access Database", desc: "Tariffs, rules and requirements for exporting to the EU", url: "https://madb.europa.eu", type: "link" },
      { title: "AfCFTA Trade Portal", desc: "African Continental Free Trade Area resources", url: "https://afcfta.au.int", type: "link" },
    ],
  },
  {
    category: "Standards & Compliance",
    items: [
      { title: "Ghana Standards Authority", desc: "Product standards and certification requirements", url: "https://www.gsa.gov.gh", type: "link" },
      { title: "FDA Ghana — Food Export", desc: "Food and drug export registration and permits", url: "https://www.fdaghana.gov.gh", type: "link" },
      { title: "CEPS Customs Guide", desc: "Ghana Customs, Excise and Preventive Service procedures", url: "https://www.gra.gov.gh", type: "link" },
    ],
  },
  {
    category: "Finance & Support",
    items: [
      { title: "EXIM Bank Ghana", desc: "Export financing, guarantees and insurance", url: "https://www.eximghana.com", type: "link" },
      { title: "GEPA Export Development Fund", desc: "Grants and support for Ghanaian exporters", url: "https://www.gepa.gov.gh", type: "link" },
    ],
  },
];

function ResourcesTab() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();
  const filtered = RESOURCES.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (i) => !q || i.title.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q),
    ),
  })).filter((cat) => cat.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Training & Resources</h2>
            <p className="mt-1 text-sm text-muted-foreground">Guides, tools and market intelligence for Ghanaian exporters.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources…"
              className="rounded-full border border-input bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">No resources match your search.</p>
      )}

      {filtered.map((cat) => (
        <div key={cat.category} className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold">{cat.category}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cat.items.map((item) => (
              <a
                key={item.title}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col justify-between gap-2 rounded-xl border border-border p-4 transition hover:border-primary hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{item.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ icon, label, value, hint }: any) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function OverviewTab({
  profile,
  userId,
  onRenew,
}: {
  profile: any;
  userId: string;
  onRenew: () => void;
}) {
  const [counts, setCounts] = useState({ apps: 0, payments: 0, certs: 0, notif: 0, tickets: 0 });
  useEffect(() => {
    void (async () => {
      const [a, p, c, n, t] = await Promise.all([
        supabase
          .from("membership_applications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("payment_submissions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("revoked", false),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .or(`user_id.eq.${userId},user_id.is.null`)
          .is("read_at", null),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .neq("status", "closed"),
      ]);
      setCounts({
        apps: a.count ?? 0,
        payments: p.count ?? 0,
        certs: c.count ?? 0,
        notif: n.count ?? 0,
        tickets: t.count ?? 0,
      });
    })();
  }, [userId]);

  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const showRenewBanner = daysLeft === null || daysLeft <= 60;
  const urgent = daysLeft !== null && daysLeft <= 14;
  return (
    <div>
      <h1 className="text-3xl font-bold">
        Welcome{profile.contact_name ? `, ${profile.contact_name}` : ""} 👋
      </h1>
      <p className="mt-1 text-muted-foreground">Your membership at a glance.</p>
      {showRenewBanner && (
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 ${expired ? "bg-destructive/10 text-destructive" : urgent ? "bg-amber-100 text-amber-900" : "bg-accent"}`}
        >
          <div>
            <p className="font-semibold">
              {expired
                ? "Your membership has expired"
                : daysLeft === null
                  ? "Activate your membership"
                  : `Your membership expires in ${daysLeft} days`}
            </p>
            <p className="text-sm opacity-80">
              {expired
                ? "Renew now to restore your benefits and certificate."
                : "Renew now to keep your member ID, certificate and benefits active."}
            </p>
          </div>
          <button
            onClick={onRenew}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Renew membership
          </button>
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Member ID"
          value={profile.member_id ?? "Pending"}
          hint={profile.member_id ? null : "Issued after first payment"}
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Tier"
          value={<span className="capitalize">{profile.tier}</span>}
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Expiry"
          value={expiry ? expiry.toLocaleDateString() : "Not active"}
          hint={
            daysLeft === null
              ? "Renew to activate"
              : expired
                ? "Subscription expired"
                : `${daysLeft} days remaining`
          }
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Status"
          value={
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${!expiry || expired ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"}`}
            >
              {!expiry ? "Inactive" : expired ? "Expired" : "Active"}
            </span>
          }
        />
      </div>

      <h2 className="mt-10 text-lg font-bold">Activity overview</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          icon={<Building2 className="h-5 w-5" />}
          label="Applications"
          value={counts.apps}
        />
        <StatCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Payments"
          value={counts.payments}
        />
        <StatCard
          icon={<FileDown className="h-5 w-5" />}
          label="Certificates"
          value={counts.certs}
        />
        <StatCard icon={<Bell className="h-5 w-5" />} label="Unread alerts" value={counts.notif} />
        <StatCard
          icon={<MessageCircle className="h-5 w-5" />}
          label="Open tickets"
          value={counts.tickets}
        />
      </div>
    </div>
  );
}

function SubscriptionTab({
  profile,
  userId,
  onChange,
}: {
  profile: any;
  userId: string;
  onChange: () => void;
}) {
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
      supabase
        .from("payment_submissions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    const gateways = (g.data ?? []).map((row: any) => ({
      ...row,
      config: { public_key: row.public_key },
    }));
    const gwMap = new Map(gateways.map((gw: any) => [gw.id, gw]));
    const submissions = (s.data ?? []).map((sub: any) => ({
      ...sub,
      payment_gateways: sub.gateway_id ? (gwMap.get(sub.gateway_id) ?? null) : null,
    }));
    setPlans(p.data ?? []);
    setGateways(gateways);
    setSubmissions(submissions);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const myPlan = plans.find((p) => p.tier === profile.tier);
  const onlineGateways = gateways.filter((g) => g.provider !== "manual_bank");
  const manualGateways = gateways.filter((g) => g.provider === "manual_bank");
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
      if ("mode" in payment && payment.mode === "flutterwave_inline") {
        await openFlutterwaveInline(payment, () => setBusy(false));
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
              <div>
                <div className="text-xs text-muted-foreground">Member ID</div>
                <div className="font-semibold">{profile.member_id ?? "Pending"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tier</div>
                <div className="font-semibold capitalize">{profile.tier}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Plan</div>
                <div className="font-semibold">
                  {myPlan ? `${myPlan.currency} ${Number(myPlan.amount).toLocaleString()}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${!expiry || expired ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {!expiry ? "Inactive" : expired ? "Expired" : "Active"}
                </span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Started</div>
                <div className="font-semibold">
                  {profile.subscription_start
                    ? new Date(profile.subscription_start).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Expires</div>
                <div className="font-semibold">{expiry ? expiry.toLocaleDateString() : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Days left</div>
                <div className="font-semibold">
                  {daysLeft === null ? "—" : daysLeft < 0 ? "Expired" : `${daysLeft}`}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Duration</div>
                <div className="font-semibold">
                  {myPlan ? `${myPlan.duration_months} months` : "—"}
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setRenewOpen(true)}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
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
            {submissions.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <div className="font-semibold">
                    {s.currency} {Number(s.amount).toLocaleString()}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      via {s.payment_gateways?.name ?? s.method}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString()} · Ref: {s.reference || "—"}
                  </div>
                  {s.admin_notes && (
                    <div className="mt-1 text-xs">
                      <span className="font-semibold">Admin:</span> {s.admin_notes}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs capitalize ${s.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : s.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}
                  >
                    {s.status}
                  </span>
                  {s.status === "confirmed" && (
                    <Link
                      to="/receipt/$id"
                      params={{ id: s.id }}
                      className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
                    >
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
            Renew on your current plan to extend your expiry, or upgrade/downgrade — your member ID
            will update to match the new plan.
          </p>
          <div className="space-y-3">
            {plans.length === 0 && (
              <p className="text-sm text-muted-foreground">No plans available right now.</p>
            )}
            {plans.map((p) => {
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
                      {isCurrent && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Your current plan
                        </span>
                      )}
                    </div>
                    {p.description && (
                      <div className="mt-1 text-xs text-muted-foreground">{p.description}</div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.duration_months} months
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {p.currency} {Number(p.amount).toLocaleString()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {/* Gateway picker (only when more than one gateway exists) */}
      {pickGatewayFor && (
        <Modal
          onClose={() => {
            setPickGatewayFor(null);
            setRenewOpen(true);
          }}
          title="Choose payment method"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onlineGateways.map((g) => (
              <button
                key={g.id}
                disabled={busy}
                onClick={() => payWithGateway(pickGatewayFor, g.id)}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60"
              >
                <CreditCard className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    Pay online via {g.provider}
                  </div>
                </div>
              </button>
            ))}
            {manualGateways.map((g) => (
              <button
                key={g.id}
                disabled={busy}
                onClick={() => payWithGateway(pickGatewayFor, g.id)}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-left hover:border-primary disabled:opacity-60"
              >
                <Banknote className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-xs text-muted-foreground">Manual bank deposit</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CertificateTab({ userId }: { userId: string }) {
  const [certs, setCerts] = useState<any[]>([]);
  useEffect(() => {
    void supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .then(({ data }) => setCerts(data ?? []));
  }, [userId]);

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-bold">Your certificates</h2>
      {certs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <FileDown className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            No certificate yet. Once admin confirms your payment, your certificate will appear here
            for download.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {certs.map((c) => {
            const valid = !c.revoked && new Date(c.expires_at) > new Date();
            return (
              <div
                key={c.id}
                className="overflow-hidden rounded-xl border border-border bg-background"
              >
                <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      ID: {c.member_id} · <span className="capitalize">{c.tier}</span>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${valid ? "bg-emerald-100 text-emerald-700" : "bg-destructive/10 text-destructive"}`}
                  >
                    {valid ? "Active" : c.revoked ? "Revoked" : "Expired"}
                  </span>
                </div>
                <div className="p-4 text-xs text-muted-foreground">
                  <div>Issued: {new Date(c.issued_at).toLocaleDateString()}</div>
                  <div>Expires: {new Date(c.expires_at).toLocaleDateString()}</div>
                  <div className="mt-1 break-all">
                    Code: <span className="font-mono">{c.verification_code}</span>
                  </div>
                </div>
                <div className="flex border-t border-border">
                  <Link
                    to="/certificate/$id"
                    params={{ id: c.id }}
                    className="flex-1 bg-primary py-2.5 text-center text-xs font-semibold text-primary-foreground"
                  >
                    View & download
                  </Link>
                  <Link
                    to="/verify/$code"
                    params={{ code: c.verification_code }}
                    className="flex-1 py-2.5 text-center text-xs font-semibold hover:bg-accent"
                  >
                    Verify page
                  </Link>
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
  const [search, setSearch] = useState("");
  useEffect(() => {
    void supabase
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems(data ?? []));
  }, [userId]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems(items.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i)));
  }

  async function markAllRead() {
    const unread = items.filter((i) => !i.read_at && i.user_id === userId);
    await Promise.all(unread.map((i) => supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", i.id)));
    setItems(items.map((i) => (!i.read_at && i.user_id === userId ? { ...i, read_at: new Date().toISOString() } : i)));
  }

  const q = search.toLowerCase();
  const filtered = items.filter((n) => !q || n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q));
  const unreadCount = items.filter((i) => !i.read_at).length;

  return (
    <div className="rounded-2xl bg-card p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Notifications</h2>
          {unreadCount > 0 && <p className="text-xs text-muted-foreground mt-0.5">{unreadCount} unread</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="rounded-full border border-input bg-background py-1.5 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring w-44"
            />
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline whitespace-nowrap">
              Mark all read
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{search ? "No results." : "No notifications."}</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border p-4 ${n.read_at ? "border-border" : "border-primary bg-primary/5"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {!n.read_at && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="font-semibold">{n.title}</div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
                {!n.read_at && n.user_id === userId && (
                  <button onClick={() => markRead(n.id)} className="text-xs text-primary hover:underline shrink-0">
                    Mark read
                  </button>
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
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    setTickets(data ?? []);
  }, [userId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function openTicket(t: any) {
    setActive(t);
    const { data } = await supabase
      .from("ticket_messages")
      .select("*")
      .eq("ticket_id", t.id)
      .order("created_at");
    setMessages(data ?? []);
  }

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ user_id: userId, subject: newSubject })
      .select()
      .single();
    if (error) return toast.error(error.message);
    await supabase
      .from("ticket_messages")
      .insert({ ticket_id: t.id, sender_id: userId, body: newBody, is_admin: false });
    setNewSubject("");
    setNewBody("");
    toast.success("Ticket opened");
    await loadTickets();
    void openTicket(t);
  }

  async function sendReply() {
    if (!active || !reply.trim()) return;
    const { error } = await supabase
      .from("ticket_messages")
      .insert({ ticket_id: active.id, sender_id: userId, body: reply, is_admin: false });
    if (error) return toast.error(error.message);
    await supabase
      .from("support_tickets")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", active.id);
    setReply("");
    void openTicket(active);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1 space-y-6">
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-3 text-base font-bold">New ticket</h3>
          <form onSubmit={createTicket} className="space-y-3">
            <input
              className={inputCls}
              placeholder="Subject"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              required
            />
            <textarea
              className={inputCls}
              rows={3}
              placeholder="Describe your issue…"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              required
            />
            <button className="w-full rounded-full bg-primary py-2 text-sm font-semibold text-primary-foreground">
              Open ticket
            </button>
          </form>
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-3 text-base font-bold">Your tickets</h3>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets yet.</p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => openTicket(t)}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${active?.id === t.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{t.subject}</span>
                      <span className="text-xs capitalize text-muted-foreground">{t.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="lg:col-span-2">
        {!active ? (
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
            Select a ticket to view the conversation.
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{active.subject}</h3>
                <span className="text-xs capitalize text-muted-foreground">{active.status}</span>
              </div>
              <button onClick={() => setActive(null)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-3 text-sm ${m.is_admin ? "bg-accent" : "bg-primary/10"}`}
                >
                  <div className="text-xs font-semibold text-muted-foreground">
                    {m.is_admin ? "FAGE Admin" : "You"} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            {active.status !== "closed" && (
              <div className="mt-4 flex gap-2">
                <textarea
                  className={inputCls}
                  rows={2}
                  placeholder="Write a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <button
                  onClick={sendReply}
                  className="self-end rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
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
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.directory_logo_url ?? null);
  const [visible, setVisible] = useState<boolean>(!!profile.directory_visible);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const { error } = await supabase
      .from("member_profiles")
      .update({
        company_name: String(fd.get("company_name") ?? ""),
        contact_name: String(fd.get("contact_name") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        country: String(fd.get("country") ?? "Ghana"),
        industry: String(fd.get("industry") ?? "") || null,
        products_exported: String(fd.get("products_exported") ?? "") || null,
        tier: String(fd.get("tier") ?? "associate") as any,
        directory_visible: visible,
        directory_bio: (String(fd.get("directory_bio") ?? "") || null),
        directory_website: (String(fd.get("directory_website") ?? "") || null),
        directory_logo_url: logoUrl,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      onSaved();
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoBusy(true);
    try {
      const { uploadImage } = await import("@/lib/uploadImage");
      const url = await uploadImage(file, "directory-logos");
      setLogoUrl(url);
      toast.success("Logo uploaded — remember to save");
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setLogoBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm grid grid-cols-1 gap-4 md:grid-cols-2">
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
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">Public Member Directory</h3>
            <p className="mt-1 text-sm text-muted-foreground">Choose whether your company appears in the directory other FAGE members can browse.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4" />
            Show my company in the directory
          </label>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium">Short bio (max 400 chars)</label>
            <textarea name="directory_bio" rows={3} maxLength={400} defaultValue={profile.directory_bio ?? ""} className={inputCls} placeholder="What does your company do? Who are your customers?" />
          </div>
          <Field icon={<Globe className="h-4 w-4" />} label="Website" name="directory_website" defaultValue={profile.directory_website ?? ""} />
          <div>
            <label className="mb-1.5 block text-sm font-medium flex items-center gap-1.5"><ImageIcon className="h-4 w-4" /> Company logo</label>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="h-14 w-14 rounded-lg border border-border object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Building2 className="h-6 w-6" />
                </div>
              )}
              <label className="cursor-pointer rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                {logoBusy ? "Uploading…" : logoUrl ? "Replace" : "Upload"}
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} disabled={logoBusy} />
              </label>
              {logoUrl && (
                <button type="button" onClick={() => setLogoUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
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
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        {icon} {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
      />
    </label>
  );
}
