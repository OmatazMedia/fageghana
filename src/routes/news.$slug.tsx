import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, User } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/news/$slug")({
  component: NewsDetail,
});

type News = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  category: string;
  author: string;
  published_at: string;
};

type Sibling = { slug: string; title: string; cover_image_url: string | null } | null;

function NewsDetail() {
  const { slug } = Route.useParams();
  const [article, setArticle] = useState<News | null>(null);
  const [prev, setPrev] = useState<Sibling>(null);
  const [next, setNext] = useState<Sibling>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    setArticle(null);
    setPrev(null);
    setNext(null);

    (async () => {
      const { data } = await supabase
        .from("news")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();

      if (cancelled) return;
      if (!data) { setMissing(true); setLoading(false); return; }
      setArticle(data as News);

      const [{ data: prevRow }, { data: nextRow }] = await Promise.all([
        supabase.from("news").select("slug,title,cover_image_url")
          .eq("published", true).gt("published_at", data.published_at)
          .order("published_at", { ascending: true }).limit(1).maybeSingle(),
        supabase.from("news").select("slug,title,cover_image_url")
          .eq("published", true).lt("published_at", data.published_at)
          .order("published_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cancelled) return;
      setPrev((prevRow as Sibling) ?? null);
      setNext((nextRow as Sibling) ?? null);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    })();

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-32 text-center text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (missing || !article) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-3xl px-4 py-32 text-center">
          <h1 className="text-3xl font-bold">Article not found</h1>
          <Link to="/news" className="mt-6 inline-flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to news
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <article className="pb-10">
        {article.cover_image_url && (
          <div className="relative h-[360px] w-full md:h-[480px]">
            <img src={article.cover_image_url} alt={article.title} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 to-transparent" />
          </div>
        )}
        <div className="mx-auto max-w-3xl px-4 py-12">
          <Link to="/news" className="mb-6 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> All news
          </Link>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{article.category}</p>
          <h1 className="mb-6 text-3xl font-bold leading-tight md:text-5xl">{article.title}</h1>
          <div className="mb-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-4 w-4" /> {article.author}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(article.published_at).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
          </div>
          {article.excerpt && <p className="mb-8 text-lg text-muted-foreground italic">{article.excerpt}</p>}
          <div className="prose prose-lg max-w-none whitespace-pre-line text-foreground/90 leading-relaxed">
            {article.body}
          </div>
        </div>
      </article>

      <nav className="border-t border-border bg-muted/30 py-10">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 md:grid-cols-2">
          {prev ? (
            <Link
              to="/news/$slug"
              params={{ slug: prev.slug }}
              className="group flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm transition hover:shadow-md"
            >
              <ArrowLeft className="h-5 w-5 shrink-0 text-primary transition group-hover:-translate-x-1" />
              {prev.cover_image_url && (
                <img src={prev.cover_image_url} alt="" className="hidden h-16 w-20 rounded-lg object-cover sm:block" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Previous article</div>
                <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{prev.title}</div>
              </div>
            </Link>
          ) : <div />}

          {next ? (
            <Link
              to="/news/$slug"
              params={{ slug: next.slug }}
              className="group flex items-center gap-4 rounded-2xl bg-card p-4 text-right shadow-sm transition hover:shadow-md md:flex-row-reverse md:text-left"
            >
              <ArrowRight className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
              {next.cover_image_url && (
                <img src={next.cover_image_url} alt="" className="hidden h-16 w-20 rounded-lg object-cover sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Next article</div>
                <div className="mt-1 line-clamp-2 font-semibold group-hover:text-primary">{next.title}</div>
              </div>
            </Link>
          ) : <div />}
        </div>

        <div className="mt-8 text-center">
          <Link to="/news" className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-accent">
            Back to all news
          </Link>
        </div>
      </nav>
    </SiteLayout>
  );
}
