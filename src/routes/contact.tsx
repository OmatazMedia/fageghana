import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Phone, MapPin, Send, Facebook, Linkedin, Instagram } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — FAGE Ghana" },
      { name: "description", content: "Get in touch with the Federation of Associations of Ghanaian Exporters. We're here to help with membership, exports and partnerships." },
      { property: "og:title", content: "Contact Us — FAGE Ghana" },
      { property: "og:description", content: "Reach the FAGE team — phone, email and our Accra office." },
    ],
  }),
  component: ContactPage,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !EMAIL_RE.test(form.email) || !form.message.trim()) {
      toast.error("Please enter your name, a valid email and a message.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim() || null,
      message: form.message.trim(),
      source: "contact_page",
    });
    setBusy(false);
    if (error) { toast.error("Could not send. Please try again."); return; }
    toast.success("Message sent! We'll be in touch shortly.");
    setForm({ name: "", email: "", subject: "", message: "" });
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Get In Touch"
        title="Contact Us"
        subtitle="Let's chat — reach out and we'll respond as soon as possible."
        imageUrl="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?q=80&w=2074&auto=format&fit=crop"
      />

      <section className="py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-5">
          {/* Form */}
          <Reveal variant="up" className="lg:col-span-3">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-sm md:p-10">
              <h2 className="text-2xl font-bold">Send us a message</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Do you have questions or feedback? We'll respond within 1–2 working days.
              </p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Your name *">
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="input" placeholder="Jane Doe" />
                  </Field>
                  <Field label="Your email *">
                    <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="input" placeholder="you@example.com" />
                  </Field>
                </div>
                <Field label="Subject">
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="input" placeholder="How can we help?" />
                </Field>
                <Field label="Your message *">
                  <textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                    className="input resize-none" placeholder="Tell us more…" />
                </Field>
                <button disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
                  {busy ? "Sending…" : <>Send message <Send className="h-4 w-4" /></>}
                </button>
              </form>
            </div>
          </Reveal>

          {/* Info */}
          <Reveal variant="up" delay={1} className="lg:col-span-2">
            <div className="space-y-4">
              <InfoCard
                icon={<Phone className="h-5 w-5" />}
                title="Phone"
                lines={[
                  <a key="1" href="tel:+233535170780" className="hover:text-primary">+233 (0) 53 517 0780</a>,
                  <a key="2" href="tel:+233535224555" className="hover:text-primary">+233 (0) 53 522 4555</a>,
                ]}
              />
              <InfoCard
                icon={<Mail className="h-5 w-5" />}
                title="Email Address"
                lines={[<a key="1" href="mailto:info@fageghana.com" className="hover:text-primary">info@fageghana.com</a>]}
              />
              <InfoCard
                icon={<MapPin className="h-5 w-5" />}
                title="Location"
                lines={["Number 22, Nii Tsatse Dzani Street", "Adjiringanor, Accra, Ghana"]}
              />

              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">Follow Us</h3>
                <div className="flex gap-3">
                  {[
                    { Icon: Linkedin, href: "https://www.linkedin.com/company/federation-of-association-of-ghanaian-exporters-fage/", label: "LinkedIn" },
                    { Icon: Instagram, href: "https://www.instagram.com/fageghana/", label: "Instagram" },
                    { Icon: Facebook, href: "https://web.facebook.com/FAGEGH", label: "Facebook" },
                  ].map(({ Icon, href, label }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-foreground/70 transition hover:bg-primary hover:text-primary-foreground">
                      <Icon className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Map */}
        <div className="mx-auto mt-12 max-w-7xl px-4">
          <div className="overflow-hidden rounded-3xl border border-border shadow-sm">
            <iframe
              title="FAGE Office Location"
              src="https://www.google.com/maps?q=Nii+Tsatse+Dzani+Street,+Adjiringanor,+Accra,+Ghana&output=embed"
              width="100%" height="420" loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              className="block w-full border-0"
            />
          </div>
        </div>
      </section>

      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid hsl(var(--input));background:hsl(var(--background));padding:0.7rem 0.9rem;font-size:0.9rem;outline:none;transition:box-shadow .2s,border-color .2s}.input:focus{box-shadow:0 0 0 2px hsl(var(--ring))}`}</style>
    </SiteLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: React.ReactNode[] }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <div className="min-w-0">
        <h4 className="text-sm font-bold uppercase tracking-wider">{title}</h4>
        <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
          {lines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
