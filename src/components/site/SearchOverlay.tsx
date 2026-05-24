import { useEffect, useRef, useState } from "react";
import { Search, X, FileText, Package, Calendar, Image as ImageIcon, Compass, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Hit = { kind: "news" | "product" | "activity" | "media" | "page"; title: string; subtitle?: string; href: string; slug?: string };

const STATIC_PAGES: { title: string; href: string; keywords: string }[] = [
  { title: "Home", href: "/", keywords: "home landing" },
  { title: "About — Who We Are", href: "/about/who-we-are", keywords: "about who we are fage history" },
  { title: "Services", href: "/services", keywords: "services support trade" },
  { title: "Products", href: "/products", keywords: "products exports" },
  { title: "Activities", href: "/activities", keywords: "activities events" },
  { title: "News & Blog", href: "/news", keywords: "news blog articles" },
  { title: "Media", href: "/media", keywords: "media photos videos gallery" },
  { title: "Membership", href: "/membership", keywords: "membership join apply tier" },
  { title: "Contact Us", href: "/contact", keywords: "contact email phone address" },
  { title: "Verify a Member", href: "/verify", keywords: "verify member certificate" },
  { title: "Member Login", href: "/login", keywords: "login signin account" },
];

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQ("");
      setResults([]);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const term = q.trim();
    const id = setTimeout(async () => {
      setLoading(true);
      const like = `%${term}%`;
      const [n, p, a, m] = await Promise.all([
        supabase.from("news").select("title,slug,excerpt").eq("published", true).or(`title.ilike.${like},excerpt.ilike.${like}`).limit(6),
        supabase.from("products").select("name,description").eq("published", true).or(`name.ilike.${like},description.ilike.${like}`).limit(6),
        supabase.from("activities").select("title,description").eq("published", true).or(`title.ilike.${like},description.ilike.${like}`).limit(6),
        supabase.from("media").select("title").eq("published", true).ilike("title", like).limit(6),
      ]);

      const hits: Hit[] = [];
      (n.data ?? []).forEach((r: any) => hits.push({ kind: "news", title: r.title, subtitle: r.excerpt ?? undefined, href: `/news/${r.slug}`, slug: r.slug }));
      (p.data ?? []).forEach((r: any) => hits.push({ kind: "product", title: r.name, subtitle: r.description ?? undefined, href: "/products" }));
      (a.data ?? []).forEach((r: any) => hits.push({ kind: "activity", title: r.title, subtitle: r.description ?? undefined, href: "/activities" }));
      (m.data ?? []).forEach((r: any) => hits.push({ kind: "media", title: r.title, href: "/media" }));

      const tl = term.toLowerCase();
      STATIC_PAGES.forEach((s) => {
        if (s.title.toLowerCase().includes(tl) || s.keywords.includes(tl)) {
          hits.push({ kind: "page", title: s.title, href: s.href });
        }
      });

      setResults(hits);
      setLoading(false);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  if (!open) return null;

  const grouped: Record<Hit["kind"], Hit[]> = { page: [], news: [], product: [], activity: [], media: [] };
  results.forEach((h) => grouped[h.kind].push(h));

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mx-4 mt-16 w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search news, products, services, activities, pages…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3">
          {!q.trim() && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Start typing to search across the website…</p>
          )}
          {q.trim() && !loading && results.length === 0 && (
            <div className="px-3 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No results found for "{q}"</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different keyword or browse our menu.</p>
            </div>
          )}
          {(["page", "news", "product", "activity", "media"] as const).map((k) =>
            grouped[k].length === 0 ? null : (
              <div key={k} className="mb-3">
                <div className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {iconFor(k)} {labelFor(k)}
                </div>
                <ul>
                  {grouped[k].map((h, i) => (
                    <li key={`${k}-${i}`}>
                      <Link to={h.href} onClick={onClose} className="block rounded-lg px-3 py-2.5 hover:bg-accent">
                        <div className="text-sm font-medium text-foreground">{h.title}</div>
                        {h.subtitle && <div className="line-clamp-1 text-xs text-muted-foreground">{h.subtitle}</div>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </div>
        <div className="border-t border-border px-5 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Press <kbd className="rounded bg-accent px-1.5 py-0.5">Esc</kbd> to close
        </div>
      </div>
    </div>
  );
}

function iconFor(k: Hit["kind"]) {
  const cls = "h-3 w-3";
  if (k === "news") return <FileText className={cls} />;
  if (k === "product") return <Package className={cls} />;
  if (k === "activity") return <Calendar className={cls} />;
  if (k === "media") return <ImageIcon className={cls} />;
  return <Compass className={cls} />;
}
function labelFor(k: Hit["kind"]) {
  return { page: "Pages", news: "News", product: "Products", activity: "Activities", media: "Media" }[k];
}
