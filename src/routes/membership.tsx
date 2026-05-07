import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Globe, Network, TrendingUp, Award, Download } from "lucide-react";
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

function MembershipPage() {
  const [plans, setPlans] = useState<Record<string, any>>({});
  useEffect(() => { void (async () => {
    const { data } = await supabase.from("subscription_plans").select("*");
    const m: Record<string, any> = {};
    (data ?? []).forEach((p: any) => { m[p.tier] = p; });
    setPlans(m);
  })(); }, []);

  function downloadForm(tierId: string) {
    const p = plans[tierId];
    if (!p?.application_form_pdf_url) return toast.error("No form available yet for this tier.");
    window.open(p.application_form_pdf_url, "_blank");
    toast.message("Form downloaded", { description: p.post_download_message ?? "", duration: 12000 });
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
              const isCorp = t.id === "corporate";
              const plan = plans[t.id];
              return (
                <div key={t.id} className={`relative rounded-3xl p-8 transition ${isCorp ? "border-2 border-primary bg-card shadow-lg" : "border border-border bg-card shadow-sm"}`}>
                  {isCorp && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">MOST RECOMMENDED</div>
                  )}
                  <p className="text-xs font-semibold tracking-widest text-primary">{t.eyebrow}</p>
                  <h3 className="mt-2 text-2xl font-bold">{t.name}</h3>
                  {plan && <p className="mt-2 text-3xl font-bold text-primary">{plan.currency} {Number(plan.amount).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/{plan.duration_months}mo</span></p>}
                  <p className="mt-3 text-muted-foreground">{t.description}</p>
                  <ul className="mt-6 space-y-3">
                    {t.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/apply/$tier" params={{ tier: t.id }} className="mt-7 block w-full rounded-full bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition hover:scale-[1.01]">
                    Apply as {t.id === "associate" ? "Associate" : "Corporate"}
                  </Link>
                  <button onClick={() => downloadForm(t.id)} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition">
                    <Download className="h-4 w-4" /> Download form (PDF)
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
    </SiteLayout>
  );
}

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
