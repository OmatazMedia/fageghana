import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  LogOut, Loader2, BadgeCheck, Calendar, CreditCard, FileDown, Bell, MessageCircle,
  Building2, Mail, Phone, MapPin, Briefcase, Upload, Send, X
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
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

  if (loading || busy || !profile) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const tabs: Array<{ id: Tab; label: string; icon: any }> = [
    { id: "overview", label: "Overview", icon: BadgeCheck },
    { id: "subscription", label: "Subscription", icon: CreditCard },
    { id: "certificate", label: "Certificate", icon: FileDown },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "support", label: "Support", icon: MessageCircle },
    { id: "profile", label: "Profile", icon: Building2 },
  ];

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

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${tab === t.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab profile={profile} userId={user!.id} />}
        {tab === "subscription" && <SubscriptionTab profile={profile} userId={user!.id} onChange={loadProfile} />}
        {tab === "certificate" && <CertificateTab userId={user!.id} />}
        {tab === "notifications" && <NotificationsTab userId={user!.id} />}
        {tab === "support" && <SupportTab userId={user!.id} />}
        {tab === "profile" && <ProfileTab profile={profile} onSaved={loadProfile} />}
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

function OverviewTab({ profile }: { profile: any; userId: string }) {
  const expiry = profile.subscription_expiry ? new Date(profile.subscription_expiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86400000) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  return (
    <div>
      <h1 className="text-3xl font-bold">Welcome{profile.contact_name ? `, ${profile.contact_name}` : ""} 👋</h1>
      <p className="mt-1 text-muted-foreground">Your membership at a glance.</p>
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
    </div>
  );
}

function SubscriptionTab({ profile, userId, onChange }: { profile: any; userId: string; onChange: () => void }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<string>("");
  const [reference, setReference] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [p, g, s] = await Promise.all([
      supabase.from("subscription_plans").select("*"),
      supabase.from("payment_gateways").select("*").eq("enabled", true).order("display_order"),
      supabase.from("payment_submissions").select("*, payment_gateways(name,provider)").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    setPlans(p.data ?? []);
    setGateways(g.data ?? []);
    setSubmissions(s.data ?? []);
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const myPlan = plans.find(p => p.tier === profile.tier);
  const selected = gateways.find(g => g.id === selectedGateway);

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!myPlan || !selected) return toast.error("Select a payment method");
    setSubmitting(true);
    try {
      let proofUrl: string | null = null;
      if (proofFile && selected.provider === "manual_bank") {
        const path = `${userId}/${Date.now()}-${proofFile.name}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("payment_submissions").insert({
        user_id: userId,
        gateway_id: selected.id,
        method: selected.provider === "manual_bank" ? "manual_bank" : "online",
        amount: myPlan.amount,
        currency: myPlan.currency,
        duration_months: myPlan.duration_months,
        reference: reference || null,
        proof_url: proofUrl,
        member_message: memberMessage || null,
      });
      if (error) throw error;
      toast.success("Payment submitted. Admin will confirm shortly.");
      setShowForm(false); setReference(""); setMemberMessage(""); setProofFile(null); setSelectedGateway("");
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Your subscription</h2>
            <p className="text-sm text-muted-foreground">
              Plan: <span className="font-semibold capitalize">{profile.tier}</span>
              {myPlan && <> · {myPlan.currency} {Number(myPlan.amount).toLocaleString()} / {myPlan.duration_months} months</>}
            </p>
            <p className="mt-1 text-sm">Expires: <span className="font-semibold">{profile.subscription_expiry ? new Date(profile.subscription_expiry).toLocaleDateString() : "—"}</span></p>
          </div>
          <button onClick={() => setShowForm(s => !s)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
            {showForm ? "Cancel" : profile.subscription_expiry ? "Renew now" : "Pay now"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submitPayment} className="mt-6 space-y-4 border-t border-border pt-6">
            <div>
              <label className="mb-2 block text-sm font-medium">Payment method</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {gateways.length === 0 && <p className="text-sm text-muted-foreground">No payment methods configured yet. Please contact admin.</p>}
                {gateways.map(g => (
                  <label key={g.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${selectedGateway === g.id ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="gw" value={g.id} checked={selectedGateway === g.id} onChange={() => setSelectedGateway(g.id)} />
                    <div>
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{g.provider.replace("_", " ")}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {selected?.provider === "manual_bank" && selected.bank_details && (
              <div className="rounded-lg bg-muted/40 p-4 text-sm">
                <div className="mb-2 font-semibold">Bank details</div>
                {Object.entries(selected.bank_details as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span><span className="font-medium">{v}</span></div>
                ))}
                <p className="mt-3 text-xs text-muted-foreground">After making the deposit, upload your proof and reference below.</p>
              </div>
            )}

            {selected && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Payment reference / transaction ID</label>
                  <input className={inputCls} value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. TXN12345" />
                </div>
                {selected.provider === "manual_bank" && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Upload payment proof</label>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setProofFile(e.target.files?.[0] ?? null)} className={inputCls} />
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Message to admin (optional)</label>
                  <textarea className={inputCls} rows={2} value={memberMessage} onChange={e => setMemberMessage(e.target.value)} />
                </div>
                <button type="submit" disabled={submitting} className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                  {submitting ? "Submitting…" : "Submit payment"}
                </button>
              </>
            )}
          </form>
        )}
      </div>

      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold">Payment history</h3>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <div className="font-semibold">{s.currency} {Number(s.amount).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">via {s.payment_gateways?.name ?? s.method}</span></div>
                  <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()} · Ref: {s.reference || "—"}</div>
                  {s.admin_notes && <div className="mt-1 text-xs"><span className="font-semibold">Admin:</span> {s.admin_notes}</div>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${s.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : s.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>{s.status}</span>
              </div>
            ))}
          </div>
        )}
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
        <p className="text-sm text-muted-foreground">No certificate issued yet. Once your payment is confirmed by admin, your certificate will appear here.</p>
      ) : (
        <div className="space-y-3">
          {certs.map(c => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4 text-sm">
              <div>
                <div className="font-semibold">{c.full_name} — <span className="capitalize">{c.tier}</span></div>
                <div className="text-xs text-muted-foreground">ID: {c.member_id} · Issued {new Date(c.issued_at).toLocaleDateString()} · Expires {new Date(c.expires_at).toLocaleDateString()}</div>
                <div className="mt-1 text-xs">Verification: <Link to="/verify/$code" params={{ code: c.verification_code }} className="text-primary hover:underline">{c.verification_code}</Link></div>
              </div>
              <Link to="/certificate/$id" params={{ id: c.id }} className="flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
                <FileDown className="h-3.5 w-3.5" /> Download
              </Link>
            </div>
          ))}
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
