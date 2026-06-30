import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowRight,
  Briefcase,
  Handshake,
  ShieldCheck,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Quote,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { AnimatedStat } from "@/components/site/AnimatedStat";
import { AnimBtn } from "@/components/site/AnimBtn";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FAGE — Federation of Associations of Ghanaian Exporters" },
      {
        name: "description",
        content:
          "Promoting non-traditional exports. FAGE empowers Ghanaian exporters through advocacy, matchmaking, trade support and research.",
      },
      { property: "og:title", content: "FAGE — Federation of Associations of Ghanaian Exporters" },
      { property: "og:description", content: "Promoting non-traditional exports across Ghana." },
      {
        property: "og:image",
        content:
          "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/5-12.png",
      },
    ],
  }),
  component: HomePage,
});

const FALLBACK_HERO_SLIDES = [
  {
    image_url:
      "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/5-12.png",
    eyebrow: "Promoting non traditional exporters",
    title: "Federation of Associations of Ghanaian Exporters",
    subtitle: null as string | null,
    cta_label: null as string | null,
    cta_href: null as string | null,
  },
];

const services = [
  {
    icon: ShieldCheck,
    title: "Advocacy",
    text: "Comprehensive Policy Framework & Strategic Business Development Initiatives",
  },
  {
    icon: Handshake,
    title: "Matchmaking",
    text: "Trade Inquiries, Networking International business partnering.",
  },
  {
    icon: Briefcase,
    title: "Trade Support",
    text: "Dynamic Trade Fairs & Comprehensive Export Insurance Solutions",
  },
  {
    icon: BookOpen,
    title: "Research",
    text: "Technical materials, business directories, export standards, policies",
  },
];

const testimonials = [
  {
    quote:
      "Joining FAGE has been a dream come true for us. Not only have we been trained on better procedures for food production but they have also helped with exporting our products globally.",
    author: "Evelyn Farms",
  },
  {
    quote:
      "FAGE has provided us with invaluable networking opportunities that have significantly boosted our market presence and helped us connect with international buyers.",
    author: "Green Valley",
  },
  {
    quote:
      "The training sessions provided by FAGE are top-notch. They have transformed our approach to sustainable farming and increased our overall yield significantly.",
    author: "Sunrise Agro",
  },
];

const PARTNERS = [
  { name: "DFTC", logo: "/images/partners/DFTC-Logo.png" },
  { name: "ERU", logo: "/images/partners/eru-logo.png" },
  { name: "Eximbank", logo: "/images/partners/Eximbank_logo-removebg-preview-1.png" },
  { name: "GIZ German Cooperation", logo: "/images/partners/German-Cooperation-n-GIZ-logo.png" },
  { name: "GIPC", logo: "/images/partners/GIPC-Logo-1.png" },
  {
    name: "Ministry of Foreign Affairs",
    logo: "/images/partners/Ministry-Of-Foreign-Affairs-and-Regional-Integration-removebg-preview-1.png",
  },
  { name: "MOFA", logo: "/images/partners/MOFA_Ministry_of_Food_and_Agriculture-1.png" },
  { name: "SPEG", logo: "/images/partners/Speg-Logo.png" },
  { name: "VEPEAG", logo: "/images/partners/vepeag-logo.png" },
];

type News = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string;
};
type Product = { id: string; name: string; image_url: string | null };

/* ── Static product showcase data ─────────────────────────────────────── */
const SHOWCASE_PRODUCTS = [
  {
    id: "1",
    num: "01",
    title: "Pineapple Production & Export",
    img: "/images/products/showcase/01-pineapple.jpeg",
    desc: "Ghana is a key player in pineapple production, producing around 678,000 metric tonnes in 2022 and ranking 13th globally, while exporting to places like Belgium, Netherlands, and the UK.",
  },
  {
    id: "2",
    num: "02",
    title: "Mango Production & Export",
    img: "/images/products/showcase/02-mango.jpeg",
    desc: "Mango production in Ghana has grown over the decades, gaining momentum in the late 20th century as farmers recognized its economic potential. Today, it is a key non-traditional export crop, contributing to foreign exchange earnings and rural employment.",
  },
  {
    id: "3",
    num: "03",
    title: "Papaya Production & Export",
    img: "/images/products/showcase/03-papaya.jpeg",
    desc: "Papaya (pawpaw) cultivation in Ghana has grown steadily, driven by favorable tropical conditions and increasing demand. It is primarily grown in the Eastern, Central, Greater Accra, and Volta Regions, with varieties like Solo, Sunrise, and Red Lady being popular for both local consumption and export.",
  },
  {
    id: "4",
    num: "04",
    title: "Vegetable Production & Export",
    img: "/images/products/showcase/04-vegetables.jpeg",
    desc: "Vegetable farming in Ghana plays a vital role in food security and economic growth, with key crops including tomatoes, onions, peppers, okra, carrots, and leafy greens. Production is concentrated in Greater Accra, Eastern, Central, Ashanti, and Northern Regions.",
  },
  {
    id: "5",
    num: "05",
    title: "Citrus Production & Export",
    img: "/images/products/showcase/05-citrus.jpeg",
    desc: "Citrus farming in Ghana, mainly involving oranges, lemons, limes, and tangerines, is a key agricultural activity, with major production areas in the Central, Eastern, Ashanti, and Brong Ahafo Regions. Smallholder farmers dominate the sector.",
  },
  {
    id: "6",
    num: "06",
    title: "Roots & Tubers Production & Export",
    img: "/images/products/showcase/06-roots-tubers.jpeg",
    desc: "Roots and tubers are staple crops in Ghana, contributing significantly to food security and economic development. Major crops include yam, cassava, cocoyam, and sweet potatoes, with production concentrated in the Brong Ahafo, Northern, Ashanti, Eastern, and Volta Regions.",
  },
  {
    id: "7",
    num: "07",
    title: "Garment Production & Export",
    img: "/images/products/showcase/07-garment.jpeg",
    desc: "Ghana's garment and textile industry has a rich history, with production centered in Accra, Tema, Kumasi, and Takoradi. The sector includes both large-scale manufacturers and small businesses specializing in African print fabrics, casual and corporate wear, uniforms, and handmade designs.",
  },
  {
    id: "8",
    num: "08",
    title: "Plant Laboratory Production & Export",
    img: "/images/products/showcase/08-plant-lab.jpeg",
    desc: "Plant laboratories in Ghana enhance agriculture through tissue culture, seed propagation, and genetic research, supporting the growth of high-yield, disease-resistant crops like bananas, pineapples, cassava, and yams for local and export markets.",
  },
  {
    id: "9",
    num: "09",
    title: "Medicinal Plants Production & Export",
    img: "/images/products/showcase/09-medicinal-plants.jpeg",
    desc: "Medicinal plant use in Ghana dates back centuries, rooted in traditional healing. Indigenous communities rely on herbs, roots, and tree barks like neem, hibiscus, moringa, prekese, aloe vera, and ginger for treating ailments and wellness.",
  },
  {
    id: "10",
    num: "10",
    title: "Fruit Processing Production & Export",
    img: "/images/products/showcase/10-fruit-processing.jpeg",
    desc: "Fruit processing in Ghana has evolved into a thriving agro-industry. Companies like Blue Skies, Pinora, and Fruittiland have boosted the production of juices, dried fruits, purees, and concentrates from pineapple, mango, papaya, and citrus.",
  },
  {
    id: "11",
    num: "11",
    title: "Shea Butter Production & Export",
    img: "/images/products/showcase/11-shea-butter.jpeg",
    desc: "Ghana is one of the world's leading producers of shea butter, sourced from the shea tree found predominantly in the Northern, Upper East, and Upper West Regions. Shea butter is exported globally for use in cosmetics, food, and pharmaceuticals.",
  },
];

/* ── ProductShowcase component ────────────────────────────────────────── */
function ProductShowcase() {
  const [active, setActive] = useState(0);
  const [animating, setAnimating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      if (animating || idx === active) return;
      setAnimating(true);
      setTimeout(() => {
        setActive(idx);
        setAnimating(false);
      }, 320);
    },
    [active, animating],
  );

  // Auto-advance every 5s
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      goTo((active + 1) % SHOWCASE_PRODUCTS.length);
    }, 5000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, goTo]);

  const current = SHOWCASE_PRODUCTS[active];
  const CARD_H = 480; // px — must match the right panel height

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* ── LEFT: same fixed height as right, nav pinned to bottom ── */}
      <div className="flex flex-col" style={{ height: `${CARD_H}px` }}>
        {/* Detail — grows to fill available space */}
        <div
          className={`flex-1 transition-all duration-300 ${animating ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"}`}
        >
          <span className="text-7xl font-extrabold text-primary/10 leading-none select-none">
            {current.num}
          </span>
          <h3 className="mt-1 text-2xl font-bold text-foreground leading-snug">{current.title}</h3>
          <p className="mt-4 text-muted-foreground leading-relaxed text-sm">{current.desc}</p>
        </div>

        {/* ── Nav pinned to bottom ── */}
        <div className="pt-6 border-t border-border">
          {/* Number pills */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {SHOWCASE_PRODUCTS.map((p, i) => (
              <button
                key={p.id}
                onClick={() => goTo(i)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  i === active
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {p.num}
              </button>
            ))}
          </div>

          {/* Prev / Next + counter */}
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                goTo((active - 1 + SHOWCASE_PRODUCTS.length) % SHOWCASE_PRODUCTS.length)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {active + 1} / {SHOWCASE_PRODUCTS.length}
            </span>
            <button
              onClick={() => goTo((active + 1) % SHOWCASE_PRODUCTS.length)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-white hover:border-primary transition"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: stacked cards, same fixed height ── */}
      <div className="relative" style={{ height: `${CARD_H}px` }}>
        {SHOWCASE_PRODUCTS.map((p, i) => {
          const offset = i - active;
          if (offset < 0 || offset > 3) return null;

          const zIndex = 10 - offset;
          const translateY = offset === 0 ? 0 : offset === 1 ? 16 : offset === 2 ? 30 : 42;
          const scale = offset === 0 ? 1 : offset === 1 ? 0.96 : offset === 2 ? 0.92 : 0.88;
          const opacity = offset === 0 ? 1 : offset === 1 ? 0.8 : offset === 2 ? 0.55 : 0.3;

          return (
            <div
              key={p.id}
              onClick={() => offset > 0 && goTo(i)}
              style={{
                position: "absolute",
                inset: 0,
                zIndex,
                transform: `translateY(${translateY}px) scale(${scale})`,
                opacity,
                transition: "all 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                cursor: offset > 0 ? "pointer" : "default",
                transformOrigin: "top center",
              }}
            >
              <div className="h-full w-full overflow-hidden rounded-2xl bg-muted shadow-md flex flex-col">
                {/* Image — shows real image if available, placeholder otherwise */}
                <div className="relative flex-1 bg-gradient-to-br from-muted to-slate-200 flex flex-col items-center justify-center gap-3 overflow-hidden">
                  {p.img ? (
                    <img
                      src={p.img}
                      alt={p.title}
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/70 shadow-sm">
                        <svg
                          className="h-8 w-8 text-primary/40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18M3.75 3h16.5A.75.75 0 0121 3.75v13.5a.75.75 0 01-.75.75H3.75A.75.75 0 013 17.25V3.75A.75.75 0 013.75 3z"
                          />
                        </svg>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/50">
                        Image coming soon
                      </span>
                    </>
                  )}
                  {/* Card label overlay */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-8">
                    <span className="text-[10px] font-bold text-white/60">{p.num}.</span>
                    <h4 className="text-sm font-bold text-white leading-snug">{p.title}</h4>
                  </div>
                </div>

                {/* ── Tiny progress bar — only on active card ── */}
                {offset === 0 && (
                  <div className="h-[3px] w-full bg-muted overflow-hidden flex-shrink-0">
                    <div
                      key={active}
                      className="h-full bg-primary rounded-full"
                      style={{ animation: "progress-bar 5s linear forwards" }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomePage() {
  const [slide, setSlide] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [testimonialIdx, setTestimonialIdx] = useState(0);
  const [heroSlides, setHeroSlides] = useState(FALLBACK_HERO_SLIDES);
  const [partners, setPartners] = useState<{ name: string; logo_url: string; link_url: string | null }[]>([]);
  const nextSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 6000);
    return () => clearInterval(t);
  }, [heroSlides.length]);

  useEffect(() => {
    void supabase
      .from("products")
      .select("id,name,image_url")
      .eq("published", true)
      .order("display_order")
      .limit(4)
      .then(({ data }) => {
        if (data) setProducts(data);
      });
    void supabase
      .from("news")
      .select("id,title,slug,excerpt,cover_image_url,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data) setNews(data);
      });
    void supabase
      .from("site_hero_slides" as any)
      .select("image_url,eyebrow,title,subtitle,cta_label,cta_href")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }: { data: any }) => {
        if (data && data.length > 0) setHeroSlides(data);
      });
    void supabase
      .from("site_partner_logos" as any)
      .select("name,logo_url,link_url")
      .eq("is_active", true)
      .order("display_order")
      .then(({ data }: { data: any }) => {
        if (data) setPartners(data);
      });
  }, []);

  function scrollToNext() {
    nextSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <SiteLayout>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden min-h-[calc(100vh-var(--header-h,120px))]">
        {/* Background slides */}
        {heroSlides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === slide ? "opacity-100" : "opacity-0"}`}
          >
            <img src={s.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/50 via-brand-dark/40 to-brand-dark/70" />
          </div>
        ))}

        {/* ── Content: centered on all screens ── */}
        <div
          className="relative z-10 mx-auto flex min-h-[calc(100vh-var(--header-h,120px))] max-w-5xl flex-col px-6 py-20 text-white
          items-center justify-center text-center"
        >
          <span className="mb-6 inline-block rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            {heroSlides[slide].eyebrow}
          </span>

          <h1
            className="!text-white font-bold leading-tight"
            style={{ fontSize: "clamp(2rem, 5vw, 5rem)" }}
          >
            {heroSlides[slide].title}
          </h1>

          <AnimBtn to="/about/who-we-are" className="mt-10">
            Learn More
          </AnimBtn>
        </div>

        {/* ── Slide dots: left-center on desktop, bottom-center on mobile ── */}
        {/* Mobile */}
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2 md:hidden">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all ${i === slide ? "w-10 bg-white" : "w-2 bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        {/* Desktop: vertical, left side, vertically centered */}
        <div className="absolute left-6 top-1/2 z-10 hidden -translate-y-1/2 flex-col gap-2 md:flex">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`rounded-full transition-all ${i === slide ? "h-10 w-2 bg-white" : "h-2 w-2 bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* ── Scroll mouse: desktop only, bottom center ── */}
        <button
          onClick={scrollToNext}
          aria-label="Scroll down"
          className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex group"
        >
          {/* Animated mouse SVG */}
          <svg
            width="28"
            height="44"
            viewBox="0 0 28 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="opacity-80 group-hover:opacity-100 transition-opacity"
          >
            <rect x="1" y="1" width="26" height="42" rx="13" stroke="white" strokeWidth="2" />
            {/* Animated scroll wheel dot */}
            <circle cx="14" cy="12" r="3" fill="white" className="hero-mouse-dot" />
          </svg>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">
            Scroll
          </span>
        </button>
      </section>

      {/* Services — 4 cards left, content right */}
      <section ref={nextSectionRef} className="bg-muted/40 py-20 scroll-mt-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <Reveal variant="up" className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {services.map((s, i) => (
              <Reveal
                key={s.title}
                delay={(i + 1) as 1 | 2 | 3 | 4}
                className="rounded-2xl bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </Reveal>
            ))}
          </Reveal>

          <Reveal variant="right">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">
              • WHAT WE DO •
            </p>
            <h2 className="mb-5 text-4xl font-bold md:text-5xl">Services</h2>
            <p className="mb-6 text-muted-foreground leading-relaxed">
              We specialize in connecting locally manufactured goods to international buyers.
              Through advocacy, matchmaking, trade support and research, FAGE empowers Ghanaian
              exporters to reach global markets with confidence.
            </p>
            <ul className="mb-8 space-y-2 text-sm text-foreground/80">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> Strategic policy
                framework & advocacy
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> International business
                matchmaking
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> Trade fairs & export
                insurance
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" /> Research & technical
                resources
              </li>
            </ul>
            <Link
              to="/services"
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition"
            >
              Explore more <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* About / Impact */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <Reveal variant="left">
            <img
              src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/21170815-9165-4c39-9770-a60ff14b40ba-fageghana-com-beak-host/assets/images/16-14.png"
              alt="About FAGE"
              className="rounded-2xl shadow-lg w-full"
            />
          </Reveal>
          <Reveal variant="right">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">ABOUT US</p>
            <h2 className="mb-5 text-3xl font-bold md:text-4xl">
              Ghana's leading enabler of Non-Traditional Exports.
            </h2>
            <p className="mb-7 text-muted-foreground leading-relaxed">
              The Federation of Associations of Ghanaian Exporters (FAGE) is an umbrella
              organization of exporter, and product associations, established in 1992. We aim to be
              Ghana's leading enabler of Non-Traditional Exports, empowering members for
              international success through global best practices, advocacy, market development, and
              facilitated funding. FAGE is dedicated to export growth and innovation.
            </p>
            <Link
              to="/about/who-we-are"
              className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
            >
              Know more about us <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <Reveal variant="fade">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE DO</p>
          </Reveal>
          <Reveal variant="up" delay={1}>
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">Our Impact By Numbers</h2>
          </Reveal>
          <Reveal variant="up" delay={2}>
            <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
              See how we are connecting locally manufactured produce with international buyers
              through measurable success.
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <AnimatedStat value={1992} label="Operational Since" noSeparator />
            <AnimatedStat value={2800} suffix="+" label="Members Added" />
            <AnimatedStat
              value={4.8}
              decimals={1}
              prefix="$"
              suffix="B"
              label="Export Value Enabled"
            />
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="py-16 bg-muted/30">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal variant="fade">
            <p className="mb-2 text-center text-sm font-semibold tracking-widest text-primary">
              OUR PARTNERS
            </p>
          </Reveal>
          <Reveal variant="up" delay={1}>
            <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">
              Trusted By Leading Institutions
            </h2>
          </Reveal>
        </div>
        {/* Marquee — full bleed, no max-w constraint */}
        <div className="marquee-wrap">
          <div className="marquee-track">
            {(() => {
              const list = partners.length > 0 ? partners : PARTNERS.map((p) => ({ name: p.name, logo_url: p.logo, link_url: null as string | null }));
              return [...list, ...list].map((p, i) => (
                <div
                  key={i}
                  className="mx-8 flex h-20 w-40 flex-shrink-0 items-center justify-center"
                >
                  <img
                    src={p.logo_url}
                    alt={p.name}
                    className="max-h-14 w-auto max-w-[140px] object-contain grayscale opacity-60 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
                  />
                </div>
              ));
            })()}
          </div>
        </div>
      </section>

      {/* Products — What We Offer */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Reveal variant="fade">
                <p className="mb-2 text-sm font-semibold tracking-widest text-primary">
                  WHAT WE OFFER
                </p>
              </Reveal>
              <Reveal variant="up" delay={1}>
                <h2 className="text-3xl font-bold md:text-4xl">
                  Products you can trust, by our members
                </h2>
              </Reveal>
            </div>
            <Reveal variant="right">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                Explore more <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <Reveal variant="up" delay={1}>
            <ProductShowcase />
          </Reveal>
        </div>
      </section>

      {/* Become a member */}
      <section className="py-20">
        <Reveal variant="scale" className="mx-auto max-w-5xl">
          <div className="rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground">
            <Reveal variant="fade">
              <p className="mb-3 text-sm font-semibold tracking-widest opacity-90">JOIN US</p>
            </Reveal>
            <Reveal variant="up" delay={1}>
              <h2 className="!text-white mb-4 text-3xl font-bold md:text-4xl">
                Become a FAGE Member
              </h2>
            </Reveal>
            <Reveal variant="up" delay={2}>
              <p className="mx-auto mb-8 max-w-xl text-white/80">
                Ready to start working together? Join Ghana's leading export federation today.
              </p>
            </Reveal>
            <Reveal variant="up" delay={3}>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  to="/membership"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-white/90 transition"
                >
                  Associate Member
                </Link>
                <Link
                  to="/membership"
                  className="rounded-full border-2 border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  Corporate Member
                </Link>
              </div>
            </Reveal>
          </div>
        </Reveal>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Reveal variant="fade">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">
              • WHAT OUR MEMBERS ARE SAYING •
            </p>
          </Reveal>
          <Reveal variant="up" delay={1}>
            <h2 className="mb-12 text-3xl font-bold md:text-4xl">Testimonials</h2>
          </Reveal>
          <Reveal variant="scale" delay={2}>
            <div className="rounded-2xl bg-card p-10 shadow-sm">
              <Quote className="mx-auto mb-6 h-10 w-10 text-primary opacity-50" />
              <p className="text-lg italic text-foreground">
                "{testimonials[testimonialIdx].quote}"
              </p>
              <p className="mt-6 font-semibold text-primary">
                — {testimonials[testimonialIdx].author}
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <button
                  onClick={() =>
                    setTestimonialIdx((i) => (i - 1 + testimonials.length) % testimonials.length)
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setTestimonialIdx((i) => (i + 1) % testimonials.length)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* News */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Reveal variant="fade">
                <p className="mb-3 text-sm font-semibold tracking-widest text-primary">UPDATES</p>
              </Reveal>
              <Reveal variant="up" delay={1}>
                <h2 className="text-3xl font-bold md:text-4xl">News and Blog</h2>
              </Reveal>
            </div>
            <Reveal variant="right">
              <Link
                to="/news"
                className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"
              >
                All news <ArrowRight className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {news.map((n, i) => (
              <Reveal key={n.id} variant="up" delay={(i + 1) as 1 | 2 | 3}>
                <Link
                  to="/news/$slug"
                  params={{ slug: n.slug }}
                  className="group overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-md h-full block"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {n.cover_image_url && (
                      <img
                        src={n.cover_image_url}
                        alt={n.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                      {new Date(n.published_at).toLocaleDateString(undefined, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mb-2 text-lg font-bold leading-snug group-hover:text-primary transition">
                      {n.title}
                    </h3>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
