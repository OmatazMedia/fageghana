import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/media")({
  head: () => ({
    meta: [
      { title: "Media Center — FAGE Ghana" },
      { name: "description", content: "News, press releases, photos, videos, and media resources about FAGE and Ghana's export sector." },
      { property: "og:title", content: "Media Center — FAGE Ghana" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=2069&auto=format&fit=crop" },
    ],
  }),
  component: MediaPage,
});

type MediaItem = { id: string; title: string; description: string | null; media_type: "photo" | "video"; url: string; thumbnail_url: string | null; category: string; created_at: string };

function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<"all" | "photo" | "video">("all");
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  useEffect(() => {
    void supabase.from("media").select("*").eq("published", true).order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setItems(data as MediaItem[]);
    });
  }, []);

  const visible = filter === "all" ? items : items.filter((i) => i.media_type === filter);

  return (
    <SiteLayout>
      <PageHero eyebrow="Press & Media" title="Media Center" subtitle="Your source for news, press releases, photos, videos, and media resources about FAGE and Ghana's export sector" imageUrl="https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=2069&auto=format&fit=crop" />

      <section className="py-16 scroll-mt-32">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <Reveal variant="left">
              <div>
                <p className="mb-2 text-sm font-semibold tracking-widest text-primary">GALLERY</p>
                <h2 className="text-3xl font-bold md:text-4xl">Photos & Videos</h2>
              </div>
            </Reveal>
            <Reveal variant="right">
              <div className="flex gap-2">
                {(["all", "photo", "video"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-5 py-2 text-sm font-medium capitalize transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"}`}>
                    {f === "all" ? "All" : `${f}s`}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((m, i) => (
              <Reveal key={m.id} variant="scale" delay={(Math.min((i % 3) + 1, 4)) as 1|2|3|4}>
                <button onClick={() => setLightbox(m)} className="group relative overflow-hidden rounded-2xl bg-muted text-left shadow-sm w-full">
                  <div className="aspect-[4/3] overflow-hidden">
                    {(m.thumbnail_url || m.url) && <img src={m.thumbnail_url ?? m.url} alt={m.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />}
                  </div>
                  {m.media_type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-primary"><Play className="h-7 w-7" /></div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <span className="inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">{m.category}</span>
                    <h3 className="mt-1 font-semibold text-white">{m.title}</h3>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
          {visible.length === 0 && <p className="py-12 text-center text-muted-foreground">No media items yet.</p>}
        </div>
      </section>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)} className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"><X className="h-5 w-5" /></button>
          <div className="max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {lightbox.media_type === "photo" ? <img src={lightbox.url} alt={lightbox.title} className="max-h-[80vh] rounded-xl" /> : <video src={lightbox.url} controls className="max-h-[80vh] rounded-xl" />}
            <p className="mt-4 text-center text-white">{lightbox.title}</p>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
