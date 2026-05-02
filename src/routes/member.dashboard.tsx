import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Building2, Mail, Phone, MapPin, Briefcase, FileText, BadgeCheck, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/member/dashboard")({
  head: () => ({ meta: [{ title: "Member Dashboard — FAGE Ghana" }] }),
  component: MemberDashboard,
});

type Tier = "associate" | "corporate";
type Status = "new" | "reviewing" | "approved" | "rejected";

type Profile = {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  industry: string | null;
  products_exported: string | null;
  tier: Tier;
  status: Status;
  notes: string | null;
};

type AppRow = {
  id: string;
  tier: Tier;
  status: Status;
  company_name: string;
  admin_notes: string | null;
  created_at: string;
};

const statusCls: Record<Status, string> = {
  new: "bg-blue-100 text-blue-700",
  reviewing: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-destructive/10 text-destructive",
};

function MemberDashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/member/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setBusy(true);
      const { data: prof } = await supabase
        .from("member_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prof) {
        const { data: created, error } = await supabase
          .from("member_profiles")
          .insert({ user_id: user.id, email: user.email ?? "", company_name: "", contact_name: "" })
          .select("*")
          .single();
        if (error) toast.error(error.message);
        else setProfile(created as Profile);
      } else {
        setProfile(prof as Profile);
      }

      const { data: appData } = await supabase
        .from("membership_applications")
        .select("id,tier,status,company_name,admin_notes,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setApps((appData ?? []) as AppRow[]);
      setBusy(false);
    })();
  }, [user]);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const update = {
      company_name: String(fd.get("company_name") ?? ""),
      contact_name: String(fd.get("contact_name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? "Ghana"),
      industry: String(fd.get("industry") ?? "") || null,
      products_exported: String(fd.get("products_exported") ?? "") || null,
      tier: String(fd.get("tier") ?? "associate") as Tier,
    };
    const { data, error } = await supabase
      .from("member_profiles")
      .update(update)
      .eq("id", profile.id)
      .select("*")
      .single();
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setProfile(data as Profile);
      toast.success("Profile saved");
    }
  }

  if (loading || busy || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your dashboard…
      </div>
    );
  }

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <div className="font-bold">FAGE Member Portal</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-primary">View site</Link>
            <button onClick={() => signOut().then(() => navigate({ to: "/" }))} className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-accent">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold">Welcome{profile.contact_name ? `, ${profile.contact_name}` : ""} 👋</h1>
        <p className="mt-1 text-muted-foreground">Manage your membership profile and track your application status.</p>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard icon={<BadgeCheck className="h-5 w-5" />} label="Membership Tier" value={profile.tier === "corporate" ? "Corporate" : "Associate"} />
          <StatCard icon={<Clock className="h-5 w-5" />} label="Status" value={<span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusCls[profile.status]}`}>{profile.status}</span>} />
          <StatCard icon={<FileText className="h-5 w-5" />} label="Applications" value={apps.length.toString()} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Profile form */}
          <section className="lg:col-span-2 rounded-2xl bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Company / Profile</h2>
            <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field icon={<Building2 className="h-4 w-4" />} label="Company name" name="company_name" defaultValue={profile.company_name} required />
              <Field icon={<UserIcon />} label="Contact name" name="contact_name" defaultValue={profile.contact_name} required />
              <Field icon={<Mail className="h-4 w-4" />} label="Email" name="email" defaultValue={profile.email} disabled />
              <Field icon={<Phone className="h-4 w-4" />} label="Phone" name="phone" defaultValue={profile.phone} required />
              <Field icon={<MapPin className="h-4 w-4" />} label="Country" name="country" defaultValue={profile.country} required />
              <Field icon={<Briefcase className="h-4 w-4" />} label="Industry" name="industry" defaultValue={profile.industry ?? ""} />
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Products you export</label>
                <textarea name="products_exported" rows={2} defaultValue={profile.products_exported ?? ""} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Preferred membership tier</label>
                <select name="tier" defaultValue={profile.tier} className={inputCls}>
                  <option value="associate">Associate</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button type="submit" disabled={saving} className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </div>
            </form>
          </section>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-2xl bg-card p-6 shadow-sm">
              <h3 className="mb-3 text-base font-bold">Your applications</h3>
              {apps.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">
                  You haven't submitted an application yet.
                  <Link to="/membership" className="mt-2 block font-semibold text-primary hover:underline">Apply now →</Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {apps.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold capitalize">{a.tier}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusCls[a.status]}`}>{a.status}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
                      {a.admin_notes && <p className="mt-2 text-xs text-foreground/80"><span className="font-semibold">Admin note:</span> {a.admin_notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm">
              <h3 className="text-base font-bold">Need help?</h3>
              <p className="mt-1 text-sm opacity-90">Reach our membership team for any questions about your account.</p>
              <a href="mailto:info@fageghana.com" className="mt-3 inline-block rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary">Contact us</a>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  );
}

function Field({ icon, label, name, defaultValue, required, disabled }: { icon: React.ReactNode; label: string; name: string; defaultValue?: string; required?: boolean; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">{icon} {label}</span>
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

function UserIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></svg>
  );
}
