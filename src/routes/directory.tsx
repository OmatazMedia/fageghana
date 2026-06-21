import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, MapPin, Mail, Phone, Building2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Exporter Directory — FAGE Ghana" },
      {
        name: "description",
        content:
          "Browse the Federation of Associations of Ghana Exporters (FAGE) directory of member associations and corporate exporters.",
      },
      { property: "og:title", content: "FAGE Exporter Directory" },
      {
        property: "og:description",
        content: "Find Ghanaian exporters of pineapples, mangoes, vegetables, yams, coconuts, cashew and more.",
      },
    ],
  }),
  component: DirectoryPage,
});

type Entry = {
  id: string;
  entry_type: "association" | "corporate";
  slug: string;
  company_name: string;
  short_description: string | null;
  products: string[];
  category: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  region: string | null;
  physical_address: string | null;
  logo_url: string | null;
  director_name: string | null;
  contact_name: string | null;
  featured: boolean;
};

function DirectoryPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "association" | "corporate">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("directory_entries")
        .select(
          "id,entry_type,slug,company_name,short_description,products,category,phone,email,country,region,physical_address,logo_url,director_name,contact_name,featured",
        )
        .eq("published", true)
        .eq("status", "approved")
        .order("featured", { ascending: false })
        .order("display_order")
        .order("company_name");
      setEntries((data ?? []) as Entry[]);
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (type !== "all" && e.entry_type !== type) return false;
      if (!term) return true;
      const hay = [
        e.company_name,
        e.contact_name ?? "",
        e.director_name ?? "",
        e.email ?? "",
        e.phone ?? "",
        e.category ?? "",
        e.country ?? "",
        (e.products ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [entries, q, type]);

  const counts = useMemo(
    () => ({
      total: entries.length,
      associations: entries.filter((e) => e.entry_type === "association").length,
      corporate: entries.filter((e) => e.entry_type === "corporate").length,
    }),
    [entries],
  );

  return (
    <SiteLayout>
      <section className="bg-gradient-to-b from-primary/10 to-background pb-12 pt-16">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="mb-3 inline-block rounded-full bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            FAGE Directory
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Ghana's Exporter Directory
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Browse {counts.associations} member associations and {counts.corporate} corporate
            exporters across pineapples, mangoes, vegetables, yams, coconut, cashew and more.
          </p>

          <div className="relative mx-auto mt-8 max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by company, email, phone, product…"
              className="h-14 w-full rounded-full border border-border bg-background pl-12 pr-4 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {(
              [
                ["all", `All (${counts.total})`],
                ["association", `Associations (${counts.associations})`],
                ["corporate", `Corporate (${counts.corporate})`],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  type === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <p className="text-lg font-semibold">No entries found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term or filter.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((e) => (
              <DirectoryCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function DirectoryCard({ entry }: { entry: Combined }) {
  const initials = entry.company_name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  const isAssoc = entry.entry_type === "association";

  const Card = (
    <div className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg">
      <div className="flex items-start gap-3">
        {entry.logo_url ? (
          <img
            src={entry.logo_url}
            alt={`${entry.company_name} logo`}
            loading="lazy"
            className="h-14 w-14 rounded-xl object-cover"
          />
        ) : (
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-xl text-sm font-bold ${
              isAssoc ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
            }`}
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isAssoc
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {isAssoc ? <Users className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {isAssoc ? "Association" : "Corporate"}
            </span>
            {entry.featured && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                Featured
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-base font-semibold leading-tight">
            {entry.company_name}
          </h3>
          {entry.category && (
            <p className="truncate text-xs text-muted-foreground">{entry.category}</p>
          )}
        </div>
      </div>

      {entry.short_description && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{entry.short_description}</p>
      )}

      {entry.products.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.products.slice(0, 4).map((p) => (
            <span
              key={p}
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
          {entry.products.length > 4 && (
            <span className="text-[11px] text-muted-foreground">+{entry.products.length - 4}</span>
          )}
        </div>
      )}

      <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {entry.phone && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> {entry.phone}
          </p>
        )}
        {entry.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="h-3 w-3" /> <span className="truncate">{entry.email}</span>
          </p>
        )}
        {(entry.physical_address || entry.country) && (
          <p className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{entry.physical_address ?? entry.country}</span>
          </p>
        )}
      </div>

      {entry.source === "curated" && (
        <div className="mt-3 text-right">
          <span className="text-xs font-semibold text-primary group-hover:underline">
            View details →
          </span>
        </div>
      )}
    </div>
  );

  if (entry.source === "curated") {
    return (
      <Link to="/directory/$slug" params={{ slug: entry.slug }}>
        {Card}
      </Link>
    );
  }
  return Card;
}
