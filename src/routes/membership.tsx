import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Globe, Network, TrendingUp, Award, Download } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { downloadFile } from "@/lib/forceDownload";
import { PostDownloadModal } from "@/components/membership/PostDownloadModal";

export const Route = createFileRoute("/membership")({
  head: () => ({
    meta: [
      { title: "Membership — FAGE Ghana" },
      { name: "description", content: "Join Ghana's premier network of exporters. Apply for FAGE Associate, Standard, or Corporate membership." },
      { property: "og:title", content: "Membership — FAGE Ghana" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: MembershipPage,
});

const TIER_META: Record<string, { name: string; eyebrow: string; description: string; benefits: string[]; recommended?: boolean }> = {
  associate: { name: "Associate Membership", eyebrow: "STARTER", description: "Ideal for small and medium-sized enterprises looking to break into international markets.", benefits: ["Access to trade fairs and exhibitions", "Market intelligence reports", "Networking with fellow exporters", "Basic training and workshops"] },
  standard:  { name: "Standard Membership",  eyebrow: "GROWING",  description: "For established exporters who need deeper market insights and advisory access.", benefits: ["All Associate benefits included", "Sector-specific market reports", "Regular advisory clinics", "Priority event invitations"] },
  corporate: { name: "Corporate Membership", eyebrow: "MOST RECOMMENDED", description: "Designed for established export companies seeking premium benefits and strategic partnerships.", benefits: ["All Standard benefits included", "Priority trade mission placement", "One-on-one business advisory", "Exclusive policy advocacy access"], recommended: true },
};

const benefits = [
  { icon: Globe,      title: "Global Market Access", text: "Connect with verified international buyers and trade partners worldwide." },
  { icon: Network,    title: "Powerful Network",      text: "Be part of 2,800+ exporters and a federation with deep government and trade ties." },
  { icon: TrendingUp, title: "Business Growth",       text: "Access training, financing facilitation, and market intelligence to scale faster." },
  { icon: Award,      title: "Trusted Recognition",   text: "Members benefit from FAGE's reputation as Ghana's premier export federation." },
];

function MembershipPage() {
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    void supabase.from("subscription_plans").select("*").order("amount").then(({ data }) => setPlans(data ?? []));
  }, []);

  async function handleDownload(plan: any) {
    if (!plan.application_form_pdf_url) return toast.error("No form available yet for this tier.");
    await downloadFile(plan.application_form_pdf_url, `FAGE-${plan.tier}-application.pdf`);
    toast.message("Form downloaded", { description: plan.post_download_message ?? "", duration: 12000 });
  }

  return (
    <SiteLayout>
      <PageHero eyebrow="Join the Federation" title="Empowering Your Export Journey" subtitle="Join Ghana's premier network of exporters and gain access to the resources, advocacy, and markets you need to succeed globally." imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" />

      <section className="py-20 scroll-mt-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <Reveal variant="fade"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">MEMBERSHIP PLANS</p></Reveal>
            <Reveal variant="up" delay={1}><h2 className="mb-4 text-3xl font-bold md:text-4xl">Choose the Right Fit for Your Business</h2></Reveal>
            <Reveal variant="up" delay={2}><p className="mx-auto max-w-2xl text-muted-foreground">We offer tailored membership categories to support businesses at every stage of their export growth.</p></Reveal>
          </div>
          {plans.length === 0 ? (
            <p className="text-center text-muted-foreground">Loading plans…</p>
          ) : (
            <div className={`grid grid-cols-1 gap-8 ${plans.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {plans.map((plan, i) => {
                const meta = TIER_META[plan.tier] ?? { name: `${plan.tier} Membership`, eyebrow: plan.tier.toUpperCase(), description: plan.description ?? "", benefits: [] };
                const isRec = !!meta.recommended;
                return (
                  <Reveal key={plan.id} variant="up" delay={(i + 1) as 1|2|3}>
                    <div className={`relative rounded-3xl p-8 h-full flex flex-col transition ${isRec ? "border-2 border-primary bg-card shadow-lg" : "border border-border bg-card shadow-sm"}`}>
                      {isRec && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground">MOST RECOMMENDED</div>}
                      <p className="text-xs font-semibold tracking-widest text-primary">{meta.eyebrow}</p>
                      <h3 className="mt-2 text-2xl font-bold">{meta.name}</h3>
                      <p className="mt-2 text-3xl font-bold text-primary">{plan.currency} {Number(plan.amount).toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/{plan.duration_months}mo</span></p>
                      <p className="mt-3 text-muted-foreground">{plan.description || meta.description}</p>
                      {meta.benefits.length > 0 && (
                        <ul className="mt-6 space-y-3 flex-1">
                          {meta.benefits.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-sm">
                              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" /><span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-7 space-y-2">
                        <Link to="/apply/$tier" params={{ tier: plan.tier }} className="block w-full rounded-full bg-primary py-3 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90">
                          Apply now
                        </Link>
                        <button onClick={() => handleDownload(plan)} className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition">
                          <Download className="h-4 w-4" /> Download form (PDF)
                        </button>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <Reveal variant="fade"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHY JOIN FAGE?</p></Reveal>
          <Reveal variant="up" delay={1}><h2 className="mb-12 text-3xl font-bold md:text-4xl">Unlocking Your Export Potential</h2></Reveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <Reveal key={b.title} variant="scale" delay={(i + 1) as 1|2|3|4}>
                <div className="rounded-2xl bg-card p-7 text-left shadow-sm h-full">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
