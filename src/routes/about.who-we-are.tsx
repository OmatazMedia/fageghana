import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, Target } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { AnimatedStat } from "@/components/site/AnimatedStat";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/about/who-we-are")({
  head: () => ({
    meta: [
      { title: "Who We Are — FAGE Ghana" },
      { name: "description", content: "FAGE is an umbrella organization of Ghanaian exporter and product associations established in 1992, dedicated to growing non-traditional exports." },
      { property: "og:title", content: "Who We Are — FAGE Ghana" },
      { property: "og:description", content: "Ghana's leading enabler of non-traditional exports since 1992." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: WhoWeArePage,
});

const CORE_VALUES = [
  { title: "Consolidated Relationship", desc: "Networking and Continuous Learning — building lasting bonds between members, partners and markets to create a resilient export ecosystem." },
  { title: "Innovation",                desc: "New Product Design & Digitization — embracing technology and creative thinking to keep Ghanaian exports competitive on the world stage." },
  { title: "Diversified Sales Channels", desc: "Expanding reach across multiple markets and platforms to reduce dependency and unlock new revenue streams for members." },
  { title: "Sustainability",             desc: "Sustainable investments in export trade — ensuring long-term growth that respects people, planet and profit equally." },
  { title: "Continuous Capacity Building", desc: "Industry specific training and certifications that equip members with the skills and knowledge to meet global standards." },
  { title: "Business Expansion",        desc: "Revenue Generation, Standardization & Product diversification — helping members scale confidently into new territories and categories." },
];

function useParallax(speed = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    function onScroll() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(center * speed);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return { ref, offset };
}

function CoreValueRow({ value, index }: { value: typeof CORE_VALUES[0]; index: number }) {
  const even = index % 2 === 0;
  const { ref, offset } = useParallax(0.08);

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-6 lg:flex-row lg:items-center ${
        even ? "" : "lg:flex-row-reverse"
      }`}
    >
      {/* Number + Title side */}
      <div
        className="flex-1"
        style={{ transform: `translateY(${even ? -offset : offset}px)`, transition: "transform 0.1s linear" }}
      >
        <Reveal variant={even ? "left" : "right"}>
          <div className={`flex flex-col gap-3 ${even ? "lg:items-end lg:text-right" : "lg:items-start lg:text-left"}`}>
            <span className="text-8xl font-extrabold leading-none text-primary/10 select-none">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-2xl font-bold text-foreground -mt-4">{value.title}</h3>
            <div className={`h-1 w-12 rounded-full bg-primary ${even ? "lg:ml-auto" : ""}`} />
          </div>
        </Reveal>
      </div>

      {/* Connector line — desktop only */}
      <div className="hidden lg:flex flex-col items-center gap-1 flex-shrink-0">
        <div className="h-16 w-px bg-border" />
        <div className="h-3 w-3 rounded-full border-2 border-primary bg-background" />
        <div className="h-16 w-px bg-border" />
      </div>

      {/* Description side */}
      <div
        className="flex-1"
        style={{ transform: `translateY(${even ? offset : -offset}px)`, transition: "transform 0.1s linear" }}
      >
        <Reveal variant={even ? "right" : "left"}>
          <div className={`rounded-2xl border border-border bg-card p-7 shadow-sm ${
            even ? "lg:text-left" : "lg:text-right"
          }`}>
            <p className="text-muted-foreground leading-relaxed">{value.desc}</p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function WhoWeArePage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About FAGE"
        title="Who we are"
        imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop"
      />

      {/* ── Our Story ── */}
      <section className="py-20 scroll-mt-32 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

            {/* Left — text */}
            <div>
              <Reveal variant="fade">
                <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHO WE ARE</p>
              </Reveal>
              <Reveal variant="up" delay={1}>
                <h2 className="mb-6 text-3xl font-bold md:text-4xl">Our Story</h2>
              </Reveal>
              <Reveal variant="up" delay={2}>
                <p className="text-muted-foreground leading-relaxed">
                  The Federation of Associations of Ghanaian Exporters (FAGE), established in 1992, is a not-for-profit umbrella organization for exporters and product associations, registered under Ghana's Companies Code (Act 179, 1963).
                </p>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  FAGE promotes the expansion and diversification of{" "}
                  <a
                    href="https://www.graphic.com.gh/business/business-news/non-traditional-export-sector-gets-major-boost-fidelity-bank-fage-sign-mou-to-boost-financing.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary"
                  >
                    Ghanaian exports to foreign markets
                  </a>
                  {" "}by assisting member firms in developing and marketing their products, and by improving the enabling environment for trade through government advocacy.
                </p>
              </Reveal>
              <Reveal variant="scale" delay={3}>
                <Link to="/membership" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition">
                  Contact us <ArrowRight className="h-4 w-4" />
                </Link>
              </Reveal>
            </div>

            {/* Right — stacked floating images */}
            <Reveal variant="right">
              <div className="relative mx-auto w-full max-w-md lg:max-w-none" style={{ height: 420 }}>

                {/* fage1 — main image, left-aligned, green border */}
                <div className="absolute left-0 top-0 w-[78%] rounded-2xl border-4 border-primary shadow-xl overflow-hidden" style={{ height: 340 }}>
                  <img
                    src="/images/fage1.jpg"
                    alt="FAGE Ghana"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/* subtle green overlay tint */}
                  <div className="absolute inset-0 bg-primary/10" />
                </div>

                {/* fage2 — smaller, floats bottom-right over fage1, white border */}
                <div className="absolute bottom-0 right-0 w-[55%] rounded-2xl border-4 border-white ring-1 ring-border shadow-2xl overflow-hidden" style={{ height: 240 }}>
                  <img
                    src="/images/fage2.jpg"
                    alt="FAGE Ghana activities"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Decorative green dot grid — top-right corner */}
                <div className="absolute -right-4 -top-4 grid grid-cols-4 gap-1.5 opacity-30">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="h-2 w-2 rounded-full bg-primary" />
                  ))}
                </div>

                {/* Decorative accent bar — bottom-left */}
                <div className="absolute -bottom-3 -left-3 h-16 w-16 rounded-xl bg-primary/20" />

                {/* Founded badge */}
                <div className="absolute left-4 bottom-6 z-10 rounded-xl bg-primary px-4 py-2 shadow-lg">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Est.</p>
                  <p className="text-xl font-extrabold text-white leading-none">1992</p>
                </div>

              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <Reveal variant="left">
              <div className="rounded-2xl border border-border bg-card p-8 h-full flex flex-col">
                {/* Icon badge */}
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/50 shadow-lg shadow-primary/20">
                  <Eye className="h-7 w-7 text-white" />
                </div>
                <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Our Vision</p>
                <h3 className="mb-4 text-xl font-bold">Market Enabler for Non-Traditional Exports</h3>
                <p className="text-muted-foreground leading-relaxed text-sm flex-1">
                  We envision being the main market enabler organization in the promoting of Non-traditional exports to foreign markets.
                </p>
                <div className="mt-6 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary/30" />
              </div>
            </Reveal>
            <Reveal variant="right">
              <div className="rounded-2xl border border-border bg-card p-8 h-full flex flex-col">
                {/* Icon badge */}
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/50 shadow-lg shadow-primary/20">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <p className="mb-2 text-xs font-semibold tracking-widest text-primary uppercase">Our Mission</p>
                <h3 className="mb-4 text-xl font-bold">Promoting Exports Through Global Standards</h3>
                <p className="text-muted-foreground leading-relaxed text-sm flex-1">
                  FAGE leverages global best standard practices in promoting Non-traditional exports to foreign markets through advocacy, member capacity building, market development services, communication and FAGE facilitated funds.
                </p>
                <div className="mt-6 h-1 w-12 rounded-full bg-gradient-to-r from-primary to-primary/30" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-24 overflow-hidden">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mb-16 text-center">
            <Reveal variant="fade">
              <p className="mb-3 text-sm font-semibold tracking-widest text-primary">OUR CORE VALUE</p>
            </Reveal>
            <Reveal variant="up" delay={1}>
              <h2 className="text-3xl font-bold md:text-4xl">Partnering For Export Growth</h2>
            </Reveal>
          </div>
          <div className="flex flex-col gap-16">
            {CORE_VALUES.map((v, i) => (
              <CoreValueRow key={v.title} value={v} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <Reveal variant="fade">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE DO</p>
          </Reveal>
          <Reveal variant="up" delay={1}>
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">Our Impact By Numbers</h2>
          </Reveal>
          <Reveal variant="up" delay={2}>
            <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
              See how we are connecting locally manufactured produce with international buyers through measurable success.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <AnimatedStat value={1992} label="Operational Since" noSeparator />
            <AnimatedStat value={2800} suffix="+" label="Members Added" />
            <AnimatedStat value={4.8} decimals={1} prefix="$" suffix="B" label="Export Value Enabled" />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-2">
          <Reveal variant="left">
            <img
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/26633402-aa43-4311-9a4d-5addc151e624/image-1769557939739.png"
              alt="Become a FAGE Member"
              className="rounded-2xl shadow-lg w-full"
            />
          </Reveal>
          <Reveal variant="right">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">JOIN US</p>
            <h2 className="mb-5 text-3xl font-bold md:text-4xl">Become a FAGE Member</h2>
            <p className="mb-7 text-muted-foreground leading-relaxed">
              Ready to start working together? Join Ghana's premier network of exporters and gain access to the resources, advocacy, and markets you need to succeed globally.
            </p>
            <Link to="/membership" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition">
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
