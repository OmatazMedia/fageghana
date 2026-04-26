import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Check, Globe, Network, TrendingUp, Award } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership — FAGE Ghana" },
      { name: "description", content: "Join Ghana's premier network of exporters. Apply for FAGE Associate or Corporate membership." },
      { property: "og:title", content: "Membership — FAGE Ghana" },
      { property: "og:description", content: "Join Ghana's premier network of exporters." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: MembershipPage,
});

const tiers = [
  {
    id: "associate" as const,
    name: "Associate Membership",
    eyebrow: "STARTER",
    description: "Ideal for small and medium-sized enterprises looking to break into international markets with guidance and support.",
    benefits: [
      "Access to trade fairs and exhibitions",
      "Market intelligence reports",
      "Networking with fellow exporters",
      "Basic training and workshops",
    ],
  },
  {
    id: "corporate" as const,
    name: "Corporate Membership",
    eyebrow: "MOST RECOMMENDED",
    description: "Designed for established export companies seeking premium benefits, priority access, and strategic partnerships.",
    benefits: [
      "All Associate benefits included",
      "Priority trade mission placement",
      "One-on-one business advisory",
      "Exclusive policy advocacy access",
    ],
  },
];

const benefits = [
  { icon: Globe, title: "Global Market Access", text: "Connect with verified international buyers and trade partners worldwide." },
  { icon: Network, title: "Powerful Network", text: "Be part of 2,800+ exporters and a federation with deep government and trade ties." },
  { icon: TrendingUp, title: "Business Growth", text: "Access training, financing facilitation, and market intelligence to scale faster." },
  { icon: Award, title: "Trusted Recognition", text: "Members benefit from FAGE's reputation as Ghana's premier export federation." },
];

const applicationSchema = z.object({
  tier: z.enum(["associate", "corporate"]),
  company_name: z.string().trim().min(2, "Company name is required").max(200),
  contact_name: z.string().trim().min(2, "Contact name is required").max(120),
  email: z.string().trim().email("Valid email required").max(255),
  phone: z.string().trim().min(6, "Phone is required").max(40),
  country: z.string().trim().min(2).max(100),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  products_exported: z.string().trim().max(500).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

function MembershipPage() {
  const [selectedTier, setSelectedTier] = useState<"associate" | "corporate">("associate");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = {
      tier: selectedTier,
      company_name: String(fd.get("company_name") ?? ""),
      contact_name: String(fd.get("contact_name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? "Ghana"),
      industry: String(fd.get("industry") ?? ""),
      products_exported: String(fd.get("products_exported") ?? ""),
      message: String(fd.get("message") ?? ""),
    };
    const parsed = applicationSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your information");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("membership_applications").insert({
      tier: parsed.data.tier,
      company_name: parsed.data.company_name,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      country: parsed.data.country,
      industry: parsed.data.industry || null,
      products_exported: parsed.data.products_exported || null,
      message: parsed.data.message || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Submission failed. Please try again.");
      return;
    }
    setSubmitted(true);
    (e.target as HTMLFormElement).reset();
    toast.success("Application submitted! We'll be in touch.");
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Join the Federation"
        title="Empowering Your Export Journey"
        subtitle="Join Ghana's premier network of exporters and gain access to the resources, advocacy, and markets you need to succeed globally."
        imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop"
      />

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">MEMBERSHIP PLANS</p>
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Choose the Right Fit for Your Business</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              We offer tailored membership categories to support businesses at every stage of their export growth.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {tiers.map((t) => {
              const isSelected = selectedTier === t.id;
              const isCorp = t.id === "corporate";
              return (
                <div
                  key={t.id}
                  className={`relative rounded-3xl p-8 transition ${
                    isCorp ? "border-2 border-primary bg-card shadow-lg" : "border border-border bg-card shadow-sm"
                  }`}
                >
                  {isCorp && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">
                      MOST RECOMMENDED
                    </div>
                  )}
                  <p className="text-xs font-semibold tracking-widest text-primary">{t.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-bold">{t.name}</h3>
                  <p className="mt-3 text-muted-foreground">{t.description}</p>
                  <ul className="mt-6 space-y-3">
                    {t.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      setSelectedTier(t.id);
                      document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`mt-7 w-full rounded-full py-3 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    Apply as {t.id === "associate" ? "Associate" : "Corporate"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHY JOIN FAGE?</p>
          <h2 className="mb-12 text-3xl font-bold md:text-4xl">Unlocking Your Export Potential</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-2xl bg-card p-7 text-left shadow-sm">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <b.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{b.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="apply" className="py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">APPLY NOW</p>
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">Submit Your Application</h2>
            <p className="text-muted-foreground">Fill in your details and our team will reach out within 3 business days.</p>
          </div>

          {submitted ? (
            <div className="mt-10 rounded-2xl border border-primary/30 bg-accent p-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-7 w-7" />
              </div>
              <h3 className="text-2xl font-bold">Thank you!</h3>
              <p className="mt-2 text-muted-foreground">Your application has been received. We'll be in touch soon.</p>
              <button onClick={() => setSubmitted(false)} className="mt-6 rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition">
                Submit another
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-10 space-y-5 rounded-2xl bg-card p-8 shadow-sm">
              <div className="flex gap-3">
                {(["associate", "corporate"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTier(t)}
                    className={`flex-1 rounded-full py-2.5 text-sm font-semibold capitalize transition ${
                      selectedTier === t ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-accent"
                    }`}
                  >
                    {t} Membership
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field name="company_name" label="Company name" required />
                <Field name="contact_name" label="Contact name" required />
                <Field name="email" label="Email" type="email" required />
                <Field name="phone" label="Phone" required />
                <Field name="country" label="Country" defaultValue="Ghana" required />
                <Field name="industry" label="Industry" placeholder="e.g. Agriculture, Textiles" />
              </div>
              <Field name="products_exported" label="Products you export (or plan to)" placeholder="e.g. Pineapple, cocoa, cashew" />
              <div>
                <label className="mb-1.5 block text-sm font-medium">Message (optional)</label>
                <textarea name="message" rows={4} maxLength={2000} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:scale-[1.01] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
