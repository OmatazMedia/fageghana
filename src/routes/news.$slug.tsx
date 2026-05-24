import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, User, Tag, TrendingUp, Facebook, Linkedin, Twitter, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news/$slug")({
  component: NewsDetail,
});

type News = {
  id: string; title: string; slug: string; excerpt: string | null;
  body: string; cover_image_url: string | null; category: string;
  author: string; published_at: string;
};
type Sibling = { slug: string; title: string; cover_image_url: string | null } | null;

function NewsDetail() {
  const { slug } = Route.useParams();
  const [article, setArticle] = useState<News | null>(null);
  const [prev, setPrev] = useState<Sibling>(null);
  const [next, setNext] = useState<Sibling>(null);
  const [related, setRelated] = useState<News[]>([]);
  const [recent, setRecent] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMissing(false); setArticle(null); setPrev(null); setNext(null);

    (async () => {
      const { data } = await supabase.from("news").select("*").eq("slug", slug).eq("published", true).maybeSingle();
      if (cancelled) return;
      if (!data) { setMissing(true); setLoading(false); return; }
      setArticle(data as News);

      const [{ data: prevRow }, { data: nextRow }, { data: relatedRows }, { data: recentRows }] = await Promise.all([
        supabase.from("news").select("slug,title,cover_image_url").eq("published", true).gt("published_at", data.published_at).order("published_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("news").select("slug,title,cover_image_url").eq("published", true).lt("published_at", data.published_at).order("published_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("news").select("id,title,slug,excerpt,cover_image_url,category,author,published_at,body").eq("published", true).eq("category", data.category).neq("slug", slug).limit(3),
        supabase.from("news").select("id,title,slug,excerpt,cover_image_url,category,author,published_at,body").eq("published", true).neq("slug", slug).order("published_at", { ascending: false }).limit(5),
      ]);
      if (cancelled) return;
      setPrev((prevRow as Sibling) ?? null);
      setNext((nextRow as Sibling) ?? null);
      setRelated((relatedRows as News[]) ?? []);
      setRecent((recentRows as News[]) ?? []);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    })();

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <SiteLayout><div className="mx-auto max-w-3xl px-4 py-32 text-center text-muted-foreground">Loading…</div></SiteLayout>;
  if (missing || !article) return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-32 text-center">
        <h1 className="text-3xl font-bold">Article not found</h1>
        <Link to="/news" className="mt-6 inline-flex items-center gap-2 text-primary"><ArrowLeft className="h-4 w-4" /> Back to news</Link>
      </div>
    </SiteLayout>
  );

  // Detect if body is HTML (from TipTap) or plain text
  const isHtml = article.body.trimStart().startsWith("<");

  return (
    <SiteLayout>
      {/* Hero image */}
      {article.cover_image_url && (
        <div className="relative h-[320px] w-full overflow-hidden md:h-[460px]">
          <img src={article.cover_image_url} alt={article.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-brand-dark/30 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="mx-auto max-w-7xl">
              <span className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">{article.category}</span>
              <h1 className="text-2xl font-bold !text-white leading-tight md:text-4xl max-w-3xl">{article.title}</h1>
            </div>
          </div>
        </div>
      )}

      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-start">

            {/* ── Article body ── */}
            <article className="flex-1 min-w-0">
              {!article.cover_image_url && (
                <>
                  <span className="mb-3 inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">{article.category}</span>
                  <h1 className="mb-4 text-3xl font-bold leading-tight md:text-4xl">{article.title}</h1>
                </>
              )}

              <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-border pb-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><User className="h-4 w-4" />{article.author}</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{new Date(article.published_at).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
                <span className="flex items-center gap-1.5"><Tag className="h-4 w-4" />{article.category}</span>
              </div>

              {article.excerpt && (
                <p className="mb-6 rounded-xl border-l-4 border-primary bg-accent/40 px-5 py-4 text-base italic text-muted-foreground">{article.excerpt}</p>
              )}

              {/* Body — HTML from TipTap or plain text */}
              {isHtml ? (
                <div className="blog-body text-foreground/90" dangerouslySetInnerHTML={{ __html: article.body }} />
              ) : (
                <div className="blog-body text-foreground/90">
                  {article.body.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}

              {/* Share + Reactions */}
              <ShareAndReactions newsId={article.id} title={article.title} />

              {/* Prev / Next */}
              <nav className="mt-12 grid grid-cols-1 gap-4 border-t border-border pt-8 md:grid-cols-2">
                {prev ? (
                  <Link to="/news/$slug" params={{ slug: prev.slug }}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:shadow-md">
                    <ArrowLeft className="h-5 w-5 shrink-0 text-primary transition group-hover:-translate-x-1" />
                    {prev.cover_image_url && <img src={prev.cover_image_url} alt="" className="hidden h-14 w-18 rounded-lg object-cover sm:block" />}
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Previous</div>
                      <div className="mt-0.5 line-clamp-2 text-sm font-semibold group-hover:text-primary transition">{prev.title}</div>
                    </div>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link to="/news/$slug" params={{ slug: next.slug }}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-right transition hover:shadow-md md:flex-row-reverse">
                    <ArrowRight className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
                    {next.cover_image_url && <img src={next.cover_image_url} alt="" className="hidden h-14 w-18 rounded-lg object-cover sm:block" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Next</div>
                      <div className="mt-0.5 line-clamp-2 text-sm font-semibold group-hover:text-primary transition">{next.title}</div>
                    </div>
                  </Link>
                ) : <div />}
              </nav>

              {/* Related posts */}
              {related.length > 0 && (
                <div className="mt-12">
                  <h2 className="mb-5 text-lg font-bold">Related Articles</h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {related.map(r => (
                      <Link key={r.id} to="/news/$slug" params={{ slug: r.slug }}
                        className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md block">
                        <div className="aspect-[16/9] overflow-hidden bg-muted">
                          {r.cover_image_url
                            ? <img src={r.cover_image_url} alt={r.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                            : <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent" />}
                        </div>
                        <div className="p-4">
                          <p className="line-clamp-2 text-sm font-semibold group-hover:text-primary transition">{r.title}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">{new Date(r.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* ── Sticky Sidebar ── */}
            <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0">
              <div className="lg:sticky lg:top-24 space-y-6">

                {/* Back link */}
                <Link to="/news" className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <ArrowLeft className="h-4 w-4" /> All articles
                </Link>

                {/* Recent posts */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    <TrendingUp className="h-4 w-4 text-primary" /> Recent Posts
                  </h3>
                  <ul className="space-y-3">
                    {recent.map(n => (
                      <li key={n.id}>
                        <Link to="/news/$slug" params={{ slug: n.slug }}
                          className={`group flex items-start gap-3 ${n.slug === slug ? "opacity-50 pointer-events-none" : ""}`}>
                          <div className="h-14 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                            {n.cover_image_url
                              ? <img src={n.cover_image_url} alt="" className="h-full w-full object-cover" />
                              : <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent" />}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-xs font-semibold leading-snug group-hover:text-primary transition">{n.title}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{new Date(n.published_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <div className="rounded-2xl bg-primary p-6 text-center text-white">
                  <h3 className="mb-2 text-base font-bold !text-white">Become a Member</h3>
                  <p className="mb-4 text-xs text-white/80">Join Ghana's premier export federation today.</p>
                  <Link to="/membership" className="inline-block rounded-full bg-white px-5 py-2 text-xs font-bold text-primary transition hover:bg-white/90">
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
