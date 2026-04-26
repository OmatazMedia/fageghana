import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Briefcase, Handshake, ShieldCheck, BookOpen, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FAGE — Federation of Associations of Ghanaian Exporters" },
      { name: "description", content: "Promoting non-traditional exports. FAGE empowers Ghanaian exporters through advocacy, matchmaking, trade support and research." },
      { property: "og:title", content: "FAGE — Federation of Associations of Ghanaian Exporters" },
      { property: "og:description", content: "Promoting non-traditional exports across Ghana." },
      { property: "og:image", content: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/5-12.png" },
    ],
  }),
  component: HomePage,
});

const heroSlides = [
  {
    image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/5-12.png",
    eyebrow: "Promoting non traditional exporters",
    title: "Federation of Associations of Ghanaian Exporters",
  },
  {
    image: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/26633402-aa43-4311-9a4d-5addc151e624-fageghana-com-beak-host/assets/images/10-13.png",
    eyebrow: "Promoting non traditional exporters",
    title: "Federation of Associations of Ghanaian Exporters",
  },
];

const services = [
  { icon: ShieldCheck, title: "Advocacy", text: "Comprehensive Policy Framework & Strategic Business Development Initiatives" },
  { icon: Handshake, title: "Matchmaking", text: "Trade Inquiries, Networking International business partnering." },
  { icon: Briefcase, title: "Trade Support", text: "Dynamic Trade Fairs & Comprehensive Export Insurance Solutions" },
  { icon: BookOpen, title: "Research", text: "Technical materials, business directories, export standards, policies" },
];

const testimonials = [
  { quote: "Joining FAGE has been a dream come true for us. Not only have we been trained on better procedures for food production but they have also helped with exporting our products globally.", author: "Evelyn Farms" },
  { quote: "FAGE has provided us with invaluable networking opportunities that have significantly boosted our market presence and helped us connect with international buyers.", author: "Green Valley" },
  { quote: "The training sessions provided by FAGE are top-notch. They have transformed our approach to sustainable farming and increased our overall yield significantly.", author: "Sunrise Agro" },
];

type Product = { id: string; name: string; image_url: string | null };
type News = { id: string; title: string; slug: string; excerpt: string | null; cover_image_url: string | null; published_at: string };

function HomePage() {
  const [slide, setSlide] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 6000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void supabase.from("products").select("id,name,image_url").eq("published", true).order("display_order").limit(4).then(({ data }) => {
      if (data) setProducts(data);
    });
    void supabase.from("news").select("id,title,slug,excerpt,cover_image_url,published_at").eq("published", true).order("published_at", { ascending: false }).limit(3).then(({ data }) => {
      if (data) setNews(data);
    });
  }, []);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative h-[600px] w-full overflow-hidden md:h-[680px]">
        {heroSlides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === slide ? "opacity-100" : "opacity-0"}`}
          >
            <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/50 via-brand-dark/40 to-brand-dark/70" />
          </div>
        ))}
        <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-4 text-center text-white">
          <span className="mb-6 inline-block rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            {heroSlides[slide].eyebrow}
          </span>
          <h1 className="!text-white text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
            {heroSlides[slide].title}
          </h1>
          <Link
            to="/about/who-we-are"
            className="mt-10 inline-flex items-center gap-3 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            Learn More
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
        {/* Slide controls */}
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all ${i === slide ? "w-10 bg-white" : "w-2 bg-white/50"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Service cards */}
      <section className="bg-muted/40 py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <div key={s.title} className="rounded-2xl bg-card p-7 shadow-sm transition hover:shadow-md">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                <s.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-bold">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services intro */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">• WHAT WE DO •</p>
          <h2 className="mb-4 text-4xl font-bold md:text-5xl">Services</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            We specialize in connecting locally manufactured goods to international buyers.
          </p>
          <Link to="/services" className="mt-8 inline-flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition">
            Explore more <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* About / Impact */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 lg:grid-cols-2 lg:items-center">
          <img
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/21170815-9165-4c39-9770-a60ff14b40ba-fageghana-com-beak-host/assets/images/16-14.png"
            alt="About FAGE"
            className="rounded-2xl shadow-lg"
          />
          <div>
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">ABOUT US</p>
            <h2 className="mb-5 text-3xl font-bold md:text-4xl">Ghana's leading enabler of Non-Traditional Exports.</h2>
            <p className="mb-7 text-muted-foreground leading-relaxed">
              The Federation of Associations of Ghanaian Exporters (FAGE) is an umbrella organization of exporter and product associations, established in 1992. We aim to be Ghana's leading enabler of Non-Traditional Exports, empowering members for international success through global best practices, advocacy, market development, and facilitated funding.
            </p>
            <Link to="/about/who-we-are" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              Know more about us <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Impact numbers */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE DO</p>
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">Our Impact By Numbers</h2>
          <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
            See how we are connecting locally manufactured produce with international buyers through measurable success.
          </p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { num: "1992", label: "Operational Since" },
              { num: "2,800+", label: "Members Added" },
              { num: "$4.8B", label: "Export Value Enabled" },
            ].map((n) => (
              <div key={n.label} className="rounded-2xl border border-border p-10">
                <div className="text-5xl font-bold text-primary">{n.num}</div>
                <div className="mt-3 text-sm uppercase tracking-wider text-muted-foreground">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE OFFER</p>
              <h2 className="text-3xl font-bold md:text-4xl">Products you can trust, by our members</h2>
            </div>
            <Link to="/products" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              Explore more <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p, i) => (
              <div key={p.id} className="group overflow-hidden rounded-2xl bg-card shadow-sm">
                <div className="aspect-[4/3] overflow-hidden bg-muted">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}.</span>
                  <h3 className="mt-1 text-lg font-bold">{p.name}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a member */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground">
          <p className="mb-3 text-sm font-semibold tracking-widest opacity-90">JOIN US</p>
          <h2 className="!text-white mb-4 text-3xl font-bold md:text-4xl">Become a FAGE Member</h2>
          <p className="mx-auto mb-8 max-w-xl text-white/80">
            Ready to start working together? Join Ghana's leading export federation today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/membership" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-white/90">
              Associate Member
            </Link>
            <Link to="/membership" className="rounded-full border-2 border-white px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Corporate Member
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">• WHAT OUR MEMBERS ARE SAYING •</p>
          <h2 className="mb-12 text-3xl font-bold md:text-4xl">Testimonials</h2>
          <div className="rounded-2xl bg-card p-10 shadow-sm">
            <Quote className="mx-auto mb-6 h-10 w-10 text-primary opacity-50" />
            <p className="text-lg italic text-foreground">"{testimonials[testimonialIdx].quote}"</p>
            <p className="mt-6 font-semibold text-primary">— {testimonials[testimonialIdx].author}</p>
            <div className="mt-8 flex justify-center gap-3">
              <button onClick={() => setTestimonialIdx((i) => (i - 1 + testimonials.length) % testimonials.length)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setTestimonialIdx((i) => (i + 1) % testimonials.length)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* News */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-widest text-primary">UPDATES</p>
              <h2 className="text-3xl font-bold md:text-4xl">News and Blog</h2>
            </div>
            <Link to="/news" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              All news <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {news.map((n) => (
              <Link key={n.id} to="/news/$slug" params={{ slug: n.slug }} className="group overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-md">
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {n.cover_image_url && (
                    <img src={n.cover_image_url} alt={n.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  )}
                </div>
                <div className="p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    {new Date(n.published_at).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <h3 className="mb-2 text-lg font-bold leading-snug group-hover:text-primary transition">{n.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
