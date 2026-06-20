import { useEffect, useMemo, useState } from "react";
import { ExternalLink, FileDown, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Resource = {
  id: string;
  title: string;
  slug: string;
  category: string | null;
  description: string | null;
  body: string | null;
  cover_image_url: string | null;
  file_url: string | null;
  external_url: string | null;
  min_tier: string | null;
  display_order: number;
};

const TIER_RANK: Record<string, number> = {
  associate: 1,
  standard: 2,
  corporate: 3,
};

export function ResourcesTabDb({ tier }: { tier: string | null | undefined }) {
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("membership_resources")
        .select("*")
        .eq("published", true)
        .order("display_order")
        .order("title");
      setItems((data ?? []) as Resource[]);
      setLoading(false);
    })();
  }, []);

  const memberRank = TIER_RANK[(tier ?? "").toLowerCase()] ?? 1;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((r) => {
        if (r.min_tier) {
          const need = TIER_RANK[r.min_tier.toLowerCase()] ?? 1;
          if (memberRank < need) return false;
        }
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.category ?? "").toLowerCase().includes(q)
        );
      });
  }, [items, search, memberRank]);

  const grouped = useMemo(() => {
    const map = new Map<string, Resource[]>();
    for (const r of filtered) {
      const key = r.category || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading resources…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Training & Resources</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Guides, tools and market intelligence for FAGE members.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search resources…"
              className="rounded-full border border-input bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring w-full sm:w-56"
            />
          </div>
        </div>
      </div>

      {grouped.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          No resources available yet.
        </p>
      )}

      {grouped.map(([cat, list]) => (
        <div key={cat} className="rounded-2xl bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold">{cat}</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((r) => {
              const href = r.file_url || r.external_url || `#`;
              return (
                <a
                  key={r.id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col gap-2 rounded-xl border border-border p-4 transition hover:border-primary hover:shadow-sm"
                >
                  {r.cover_image_url && (
                    <img
                      src={r.cover_image_url}
                      alt=""
                      className="h-28 w-full rounded-lg object-cover"
                    />
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold leading-snug">{r.title}</span>
                    {r.file_url ? (
                      <FileDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
