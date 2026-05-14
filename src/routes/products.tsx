import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Leaf, Package, Award, Sprout, X } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Our Products — FAGE Ghana" },
      { name: "description", content: "Quality Ghanaian products trusted by international buyers worldwide." },
      { property: "og:title", content: "Our Products — FAGE Ghana" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80" },
    ],
  }),
  component: ProductsPage,
});

const categories = [
  { icon: Leaf,    title: "Fresh Produce",   text: "Farm-fresh fruits and vegetables harvested at peak quality." },
  { icon: Package, title: "Processed Foods", text: "Value-added products including dried fruits, juices, and packaged goods." },
  { icon: Award,   title: "Export Quality",  text: "All products meet international quality certifications and food safety standards." },
  { icon: Sprout,  title: "Sustainable",     text: "Products sourced from sustainable farming practices supporting local communities." },
];

const FEATURED = [
  { num: "01", title: "Pineapple Production & Export",        img: "/images/products/showcase/01-pineapple.jpeg",        desc: "Ghana is a key player in pineapple production, producing around 678,000 metric tonnes in 2022 and ranking 13th globally, while exporting to places like Belgium, Netherlands, and the UK." },
  { num: "02", title: "Mango Production & Export",            img: "/images/products/showcase/02-mango.jpeg",            desc: "Mango production in Ghana has grown over the decades, gaining momentum in the late 20th century as farmers recognized its economic potential. Today, it is a key non-traditional export crop, contributing to foreign exchange earnings and rural employment." },
  { num: "03", title: "Papaya Production & Export",           img: "/images/products/showcase/03-papaya.jpeg",           desc: "Papaya (pawpaw) cultivation in Ghana has grown steadily, driven by favorable tropical conditions and increasing demand. It is primarily grown in the Eastern, Central, Greater Accra, and Volta Regions." },
  { num: "04", title: "Vegetable Production & Export",        img: "/images/products/showcase/04-vegetables.jpeg",       desc: "Vegetable farming in Ghana plays a vital role in food security and economic growth, with key crops including tomatoes, onions, peppers, okra, carrots, and leafy greens." },
  { num: "05", title: "Citrus Production & Export",           img: "/images/products/showcase/05-citrus.jpeg",           desc: "Citrus farming in Ghana, mainly involving oranges, lemons, limes, and tangerines, is a key agricultural activity, with major production areas in the Central, Eastern, Ashanti, and Brong Ahafo Regions." },
  { num: "06", title: "Roots & Tubers Production & Export",   img: "/images/products/showcase/06-roots-tubers.jpeg",     desc: "Roots and tubers are staple crops in Ghana, contributing significantly to food security and economic development. Major crops include yam, cassava, cocoyam, and sweet potatoes." },
  { num: "07", title: "Garment Production & Export",          img: "/images/products/showcase/07-garment.jpeg",          desc: "Ghana's garment and textile industry has a rich history, with production centered in Accra, Tema, Kumasi, and Takoradi, specializing in African print fabrics, casual and corporate wear." },
  { num: "08", title: "Plant Laboratory Production & Export", img: "/images/products/showcase/08-plant-lab.jpeg",        desc: "Plant laboratories in Ghana enhance agriculture through tissue culture, seed propagation, and genetic research, supporting high-yield, disease-resistant crops for local and export markets." },
  { num: "09", title: "Medicinal Plants Production & Export", img: "/images/products/showcase/09-medicinal-plants.jpeg", desc: "Medicinal plant use in Ghana dates back centuries. Indigenous communities rely on herbs, roots, and tree barks like neem, hibiscus, moringa, prekese, aloe vera, and ginger." },
  { num: "10", title: "Fruit Processing Production & Export", img: "/images/products/showcase/10-fruit-processing.jpeg", desc: "Fruit processing in Ghana has evolved into a thriving agro-industry producing juices, dried fruits, purees, and concentrates from pineapple, mango, papaya, and citrus." },
  { num: "11", title: "Shea Butter Production & Export",      img: "/images/products/showcase/11-shea-butter.jpeg",      desc: "Ghana is one of the world's leading producers of shea butter, exported globally for use in cosmetics, food, and pharmaceuticals, sourced from the Northern regions." },
];

function FeaturedGrid() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4 space-y-5">
      {FEATURED.map((p, i) => {
        const isActive = active === i;
        /* alternate tall/short for masonry rhythm */
        const tall = i % 3 === 0;
        return (
          <Reveal key={p.num} variant="scale" delay={((i % 3) + 1) as 1|2|3}>
            <div
              onClick={() => setActive(isActive ? null : i)}
              className={[
                "break-inside-avoid relative overflow-hidden rounded-2xl cursor-pointer group",
                "transition-all duration-500 shadow-sm hover:shadow-xl",
                tall ? "h-80" : "h-56",
                isActive ? "ring-2 ring-primary ring-offset-2" : "",
              ].join(" ")}
            >
              {/* background image */}
              <img
                src={p.img}
                alt={p.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* always-visible dark gradient + number */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute top-4 left-4 text-5xl font-extrabold leading-none text-white/20 select-none">
                {p.num}
              </span>

              {/* default footer — title */}
              <div className={`absolute bottom-0 inset-x-0 px-5 pb-4 transition-all duration-300 ${
                isActive ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
              }`}>
                <h3 className="text-sm font-bold text-white leading-snug">{p.title}</h3>
              </div>

              {/* expanded overlay — description */}
              <div className={`absolute inset-0 flex flex-col justify-end bg-primary/90 px-5 pb-5 pt-10 transition-all duration-300 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}>
                <button
                  onClick={(e) => { e.stopPropagation(); setActive(null); }}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition"
                  aria-label="Close"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
                <span className="text-xs font-bold text-white/60 mb-1">{p.num}</span>
                <h3 className="text-base font-bold text-white leading-snug mb-2">{p.title}</h3>
                <p className="text-xs text-white/85 leading-relaxed line-clamp-5">{p.desc}</p>
              </div>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

function ProductsPage() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Our Products" title="Our Products" subtitle="Quality Ghanaian products trusted by international buyers worldwide" imageUrl="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80" />

      <section className="py-20 scroll-mt-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <Reveal variant="fade"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE OFFER</p></Reveal>
            <Reveal variant="up" delay={1}><h2 className="mb-4 text-3xl font-bold md:text-4xl">Products You Can Trust</h2></Reveal>
            <Reveal variant="up" delay={2}><p className="mx-auto max-w-2xl text-muted-foreground">FAGE members produce and export a diverse range of high-quality agricultural products meeting international standards.</p></Reveal>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((c, i) => (
              <Reveal key={c.title} variant="scale" delay={(i + 1) as 1|2|3|4}>
                <div className="rounded-2xl border border-border bg-card p-6 transition hover:shadow-md h-full">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                    <c.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                  <p className="text-sm text-muted-foreground">{c.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products — masonry click-to-expand grid */}
      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <Reveal variant="fade"><p className="mb-3 text-sm font-semibold tracking-widest text-primary">FEATURED PRODUCTS</p></Reveal>
            <Reveal variant="up" delay={1}><h2 className="mb-3 text-3xl font-bold md:text-4xl">Our Main Exports</h2></Reveal>
            <Reveal variant="up" delay={2}><p className="mx-auto max-w-xl text-muted-foreground">Click any product to learn more about it.</p></Reveal>
          </div>
          <FeaturedGrid />
        </div>
      </section>
    </SiteLayout>
  );
}
