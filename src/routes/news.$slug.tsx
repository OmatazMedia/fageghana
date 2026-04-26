import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Calendar, User } from "lucide-react";
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

function NewsDetail() {
  const { slug } = Route.useParams();
  const [article, setArticle] = useState<News | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setLoading(true);
    setMissing(false);
    void supabase
      .from("news")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setArticle(data as News);
        else setMissing(true);
        setLoading(false);
      });
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
      <article className="pb-20">
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
    </SiteLayout>
  );
}
