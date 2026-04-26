import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Handshake, Briefcase, BookOpen, Check } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Our Services — FAGE Ghana" },
      { name: "description", content: "FAGE provides comprehensive support for Ghanaian exporters: advocacy, matchmaking, trade support and research." },
      { property: "og:title", content: "Our Services — FAGE Ghana" },
      { property: "og:description", content: "Empowering Ghanaian exporters with comprehensive support, market access, and strategic resources." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: ServicesPage,
});

const serviceList = [
  {
    icon: Megaphone,
    title: "Advocacy",
    text: "We represent the interests of our members at the highest levels of government and international trade organizations. Our advocacy efforts focus on creating favorable policies and reducing trade barriers.",
    bullets: [
      "Policy development and reform advocacy",
      "Trade barrier reduction initiatives",
      "Government and stakeholder engagement",
    ],
  },
  {
    icon: Handshake,
    title: "Matchmaking",
    text: "Our matchmaking services connect Ghanaian exporters with international buyers, distributors, and trade partners. We facilitate business-to-business meetings.",
    bullets: [
      "Buyer-seller connection programs",
      "Trade missions and exhibitions",
      "B2B meeting facilitation",
    ],
  },
  {
    icon: Briefcase,
    title: "Trade Support",
    text: "We provide comprehensive trade support services including capacity building, technical assistance, and access to export financing for production procedures.",
    bullets: [
      "Export training and capacity building",
      "Trade finance facilitation",
      "Technical assistance programs",
    ],
  },
  {
    icon: BookOpen,
    title: "Research",
    text: "Our research division produces market intelligence, business directories, export standards documentation, and policy briefs to inform exporter decision-making.",
    bullets: [
      "Market intelligence reports",
      "Export standards documentation",
      "Industry research publications",
    ],
  },
];

function ServicesPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="What We Offer"
        title="Our Services"
        subtitle="Empowering Ghanaian exporters with comprehensive support, market access, and strategic resources."
        imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop"
      />

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">CORE COMPETENCIES</p>
          <h2 className="mb-5 text-3xl font-bold md:text-4xl">Connecting Locally Manufactured Goods to International Buyers</h2>
          <p className="text-muted-foreground leading-relaxed">
            FAGE provides a comprehensive suite of services designed to support Ghanaian exporters at every stage of their export journey. From policy advocacy to market access, we are committed to your success in international markets.
          </p>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 md:grid-cols-2">
          {serviceList.map((s) => (
            <div key={s.title} className="rounded-2xl bg-card p-8 shadow-sm">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-accent">
                <s.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mb-3 text-2xl font-bold">{s.title}</h3>
              <p className="mb-5 text-muted-foreground leading-relaxed">{s.text}</p>
              <ul className="space-y-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}
