import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Calendar, User, Tag, ArrowRight, TrendingUp } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "News & Blog — FAGE Ghana" },
      {
        name: "description",
        content: "Stay informed about the latest developments in Ghana's export sector.",
      },
      { property: "og:title", content: "News & Blog — FAGE Ghana" },
      {
        property: "og:image",
        content:
          "https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop",
      },
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

function NewsPage() {
  const [news, setNews] = useState<News[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    void supabase
      .from("news")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setNews(data as News[]);
        const cats = [
          "All",
          ...Array.from(new Set((data as News[]).map((n) => n.category).filter(Boolean))),
        ];
        setCategories(cats);
      });
  }, []);

  const filtered = news.filter((n) => {
    const matchCat = active === "All" || n.category === active;
    const matchSearch =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      (n.excerpt ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const featured = filtered[0];
  const rest = filtered.slice(1);
  const recent = [...news].slice(0, 5);

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Updates"
        title="News & Blog"
        subtitle="Stay informed about the latest developments in Ghana's export sector"
        imageUrl="https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop"
      />

      <section className="py-14">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
            {/* ── Main content ── */}
            <div className="flex-1 min-w-0">
              {/* Featured post */}
              {featured && (
                <Reveal variant="up">
                  <Link
                    to="/news/$slug"
                    params={{ slug: featured.slug }}
                    className="group mb-10 grid grid-cols-1 overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-lg md:grid-cols-2 block"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto">
                      {featured.cover_image_url ? (
                        <img
                          src={featured.cover_image_url}
                          alt={featured.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-primary/20 to-accent" />
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                        Featured
                      </span>
                    </div>
                    <div className="flex flex-col justify-center p-7">
                      <span className="mb-2 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary w-fit">
                        {featured.category}
                      </span>
                      <h2 className="mb-3 text-xl font-bold leading-snug group-hover:text-primary transition md:text-2xl">
                        {featured.title}
                      </h2>
                      <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                        {featured.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {featured.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(featured.published_at).toLocaleDateString(undefined, {
                            dateStyle: "medium",
                          })}
                        </span>
                      </div>
                      <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                        Read more{" "}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              )}

              {/* Category pills */}
              <Reveal variant="fade">
                <div className="mb-6 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setActive(c)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${active === c ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Reveal>

              {/* Grid */}
              {rest.length === 0 && !featured && (
                <p className="py-16 text-center text-muted-foreground">No articles found.</p>
              )}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {rest.map((n, i) => (
                  <Reveal key={n.id} variant="up" delay={((i % 2) + 1) as 1 | 2}>
                    <Link
                      to="/news/$slug"
                      params={{ slug: n.slug }}
                      className="group flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-md h-full block"
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-muted">
                        {n.cover_image_url ? (
                          <img
                            src={n.cover_image_url}
                            alt={n.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                            {n.category}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(n.published_at).toLocaleDateString(undefined, {
                              dateStyle: "medium",
                            })}
                          </span>
                        </div>
                        <h3 className="mb-2 flex-1 text-base font-bold leading-snug group-hover:text-primary transition">
                          {n.title}
                        </h3>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{n.excerpt}</p>
                        <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                          Read more{" "}
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>

            {/* ── Sticky Sidebar ── */}
            <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Search */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">Search</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search articles…"
                      className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Categories */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">Categories</h3>
                  <ul className="space-y-1">
                    {categories.map((c) => {
                      const count =
                        c === "All" ? news.length : news.filter((n) => n.category === c).length;
                      return (
                        <li key={c}>
                          <button
                            onClick={() => setActive(c)}
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition cursor-pointer ${active === c ? "bg-primary text-white font-semibold" : "hover:bg-accent text-foreground"}`}
                          >
                            <span className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5" />
                              {c}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active === c ? "bg-white text-primary" : "bg-muted text-muted-foreground"}`}
                            >
                              {count}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Recent posts */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    <TrendingUp className="h-4 w-4 text-primary" /> Recent Posts
                  </h3>
                  <ul className="space-y-3">
                    {recent.map((n) => (
                      <li key={n.id}>
                        <Link
                          to="/news/$slug"
                          params={{ slug: n.slug }}
                          className="group flex items-start gap-3"
                        >
                          <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                            {n.cover_image_url ? (
                              <img
                                src={n.cover_image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-primary transition">
                              {n.title}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {new Date(n.published_at).toLocaleDateString(undefined, {
                                dateStyle: "medium",
                              })}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="rounded-2xl bg-primary p-6 text-center text-white">
                  <h3 className="mb-2 text-base font-bold !text-white">Become a Member</h3>
                  <p className="mb-4 text-xs text-white/80">
                    Join Ghana's premier export federation and access exclusive resources.
                  </p>
                  <Link
                    to="/membership"
                    className="inline-block rounded-full bg-white px-5 py-2 text-xs font-bold text-primary transition hover:bg-white/90"
                  >
                    Join FAGE
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
