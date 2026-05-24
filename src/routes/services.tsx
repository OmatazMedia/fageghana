import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, Handshake, Briefcase, BookOpen, GraduationCap } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";

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
  { icon: BookOpen, title: "Research", text: "Technical materials, business directories, export standards, policies" },
  { icon: Handshake, title: "Matchmaking", text: "Trade Inquiries, Networking International business partnering" },
  { icon: Briefcase, title: "Trade Support", text: "Dynamic Trade Fairs & Comprehensive Export Insurance Solutions", link: "https://www.modernghana.com/news/1315897/horticulture-in-ghana-to-increase-food-production.html" },
  { icon: Megaphone, title: "Advocacy", text: "Comprehensive Policy Framework & Strategic Business Development Initiatives" },
  { icon: GraduationCap, title: "Seminars", text: "Global G.A.P., Export Management, Marketing, Training" },
];

function ServicesPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="What We Offer" title="Our Services" subtitle="Empowering Ghanaian exporters with comprehensive support, market access, and strategic resources." imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" />

      <section className="py-20 scroll-mt-32">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Reveal variant="fade"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">CORE COMPETENCIES</p></Reveal>
          <Reveal variant="up" delay={1}><h2 className="mb-5 text-3xl font-bold md:text-4xl">Connecting Locally Manufactured Goods to International Buyers</h2></Reveal>
          <Reveal variant="up" delay={2}><p className="text-muted-foreground leading-relaxed">FAGE provides a comprehensive suite of services designed to support Ghanaian exporters at every stage of their export journey.</p></Reveal>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 md:grid-cols-2">
          {serviceList.map((s, i) => (
            <Reveal key={s.title} variant={i % 2 === 0 ? "left" : "right"} delay={(Math.min(i + 1, 5)) as 1|2|3|4|5}>
              <div className="rounded-2xl bg-card p-8 shadow-sm h-full">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-accent">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="mb-3 text-2xl font-bold">{s.title}</h3>
                {s.link ? (
                  <p className="mb-5 text-muted-foreground leading-relaxed">
                    <a href={s.link} className="text-primary hover:text-primary/80" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>Dynamic Trade Fairs</a> & Comprehensive Export Insurance Solutions
                  </p>
                ) : (
                  <p className="mb-5 text-muted-foreground leading-relaxed">{s.text}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}