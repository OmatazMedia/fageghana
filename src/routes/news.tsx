import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & Updates — FAGE Ghana" },
      { name: "description", content: "Stay informed about the latest developments in Ghana's export sector." },
      { property: "og:title", content: "News & Updates — FAGE Ghana" },
      { property: "og:description", content: "Stay informed about the latest developments in Ghana's export sector." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: NewsPage,
});

type News = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string;
  author: string;
  published_at: string;
};

const categories = ["All", "Events", "Trade Shows", "Industry News", "Member Stories", "Policy Updates", "Training"];

function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [active, setActive] = useState("All");

  useEffect(() => {
    void supabase.from("news").select("*").eq("published", true).order("published_at", { ascending: false }).then(({ data }) => {
      if (data) setNews(data as News[]);
    });
  }, []);

  const filtered = active === "All" ? news : news.filter((n) => n.category === active);
  const featured = news[0];
  const rest = filtered.filter((n) => n.id !== featured?.id);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Updates"
        title="News & Updates"
        subtitle="Stay informed about the latest developments in Ghana's export sector"
        imageUrl="https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop"
      />

      {featured && (
        <section className="py-16">
          <div className="mx-auto max-w-7xl px-4">
            <Link to="/news/$slug" params={{ slug: featured.slug }} className="group grid grid-cols-1 overflow-hidden rounded-3xl bg-card shadow-sm lg:grid-cols-2">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto">
                {featured.cover_image_url && (
                  <img src={featured.cover_image_url} alt={featured.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                )}
                <div className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
                  {new Date(featured.published_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" }).toUpperCase()}
                </div>
              </div>
              <div className="flex flex-col justify-center p-8 lg:p-12">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Featured Story</p>
                <h2 className="mb-4 text-2xl font-bold leading-tight md:text-3xl group-hover:text-primary transition">{featured.title}</h2>
                <p className="mb-2 text-sm text-muted-foreground">{featured.author}</p>
                <p className="mb-6 text-muted-foreground">{featured.excerpt}</p>
                <span className="inline-flex items-center gap-2 font-semibold text-primary">
                  Read Full Story <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                  active === c ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-accent"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((n) => (
              <Link key={n.id} to="/news/$slug" params={{ slug: n.slug }} className="group overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-md">
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {n.cover_image_url && <img src={n.cover_image_url} alt={n.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                </div>
                <div className="p-5">
                  <div className="mb-2 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    <span>{n.category}</span>
                    <span>•</span>
                    <span>{new Date(n.published_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="mb-2 text-lg font-bold leading-snug group-hover:text-primary transition">{n.title}</h3>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
                </div>
              </Link>
            ))}
            {rest.length === 0 && (
              <p className="col-span-full py-12 text-center text-muted-foreground">No articles in this category yet.</p>
            )}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
