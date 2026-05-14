import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, MapPin, Users } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/activities")({
  head: () => ({
    meta: [
      { title: "Activities & Events — FAGE Ghana" },
      { name: "description", content: "Trade missions, capacity building, networking events, and industry-leading programs from FAGE." },
      { property: "og:title", content: "Activities & Events — FAGE Ghana" },
      { property: "og:image", content: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: ActivitiesPage,
});

type Activity = { id: string; title: string; category: string; description: string; image_url: string | null; location: string | null; event_date: string | null; spots_remaining: number | null; is_featured: boolean };

function ActivitiesPage() {
  const [items, setItems] = useState<Activity[]>([]);

  useEffect(() => {
    void supabase.from("activities").select("*").eq("published", true).order("event_date", { ascending: true }).then(({ data }) => {
      if (data) setItems(data as Activity[]);
    });
  }, []);

  const featured = items.find((i) => i.is_featured) ?? items[0];
  const rest = items.filter((i) => i.id !== featured?.id);

  return (
    <SiteLayout>
      <PageHero eyebrow="What We Do" title="Activities & Events" subtitle="Empowering Ghana's exporters through trade missions, capacity building, networking events, and industry-leading programs" imageUrl="https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop" />

      {featured && (
        <section className="py-16 scroll-mt-32">
          <div className="mx-auto max-w-7xl px-4">
            <Reveal variant="fade"><p className="mb-3 text-center text-sm font-semibold tracking-widest text-primary">FEATURED EVENT</p></Reveal>
            <Reveal variant="up" delay={1}><h2 className="mb-10 text-center text-3xl font-bold md:text-4xl">Don't Miss This Opportunity</h2></Reveal>
            <Reveal variant="scale" delay={2}>
              <div className="grid grid-cols-1 overflow-hidden rounded-3xl bg-card shadow-sm lg:grid-cols-2">
                <div className="relative aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto">
                  {featured.image_url && <img src={featured.image_url} alt={featured.title} className="h-full w-full object-cover" />}
                  <div className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{featured.category}</div>
                </div>
                <div className="flex flex-col justify-center gap-4 p-8 lg:p-12">
                  <h3 className="text-2xl font-bold md:text-3xl">{featured.title}</h3>
                  <div className="flex flex-wrap gap-5 text-sm text-muted-foreground">
                    {featured.event_date && <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{new Date(featured.event_date).toLocaleDateString(undefined, { dateStyle: "long" })}</span>}
                    {featured.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{featured.location}</span>}
                    {featured.spots_remaining !== null && <span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" />{featured.spots_remaining} spots remaining</span>}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{featured.description}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <section className="bg-muted/40 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <Reveal variant="fade"><p className="mb-3 text-center text-sm font-semibold tracking-widest text-primary">OUR PROGRAMS</p></Reveal>
          <Reveal variant="up" delay={1}><h2 className="mb-3 text-center text-3xl font-bold md:text-4xl">Comprehensive Activity Portfolio</h2></Reveal>
          <Reveal variant="up" delay={2}><p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">We organize diverse activities designed to support exporters at every stage of their growth journey</p></Reveal>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((a, i) => (
              <Reveal key={a.id} variant="up" delay={(Math.min((i % 3) + 1, 4)) as 1|2|3|4}>
                <div className="overflow-hidden rounded-2xl bg-card shadow-sm transition hover:shadow-md h-full">
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {a.image_url && <img src={a.image_url} alt={a.title} className="h-full w-full object-cover" />}
                  </div>
                  <div className="p-6">
                    <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">{a.category}</span>
                    <h3 className="mt-3 text-lg font-bold">{a.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{a.description}</p>
                    <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                      {a.event_date && <div className="flex items-center gap-1"><Calendar className="h-3 w-3 text-primary" />{new Date(a.event_date).toLocaleDateString()}</div>}
                      {a.location && <div className="flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{a.location}</div>}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
            {rest.length === 0 && items.length === 0 && <p className="col-span-full py-12 text-center text-muted-foreground">No activities scheduled yet.</p>}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
