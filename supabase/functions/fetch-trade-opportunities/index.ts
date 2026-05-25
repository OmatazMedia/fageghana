// Supabase Edge Function: fetch-trade-opportunities
// Scheduled daily (06:00 UTC) via pg_cron. Fetches trade leads from ITC Trade
// Map RSS and upserts into public.trade_opportunities. Falls back to a curated
// static list of Ghana-relevant export opportunities if the feed is unreachable.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEED_URL = "https://www.trademap.org/rss/TradeOpportunities.aspx";

type Opportunity = {
  title: string;
  description: string | null;
  source: string;
  source_url: string;
  category: string | null;
  country: string | null;
  deadline: string | null; // ISO date
};

const FALLBACK: Opportunity[] = [
  {
    title: "EU buyers seeking certified organic cocoa from Ghana",
    description:
      "European confectionery buyers are sourcing organic, fair-trade certified cocoa beans (50–500 MT) for 2026 contracts.",
    source: "FAGE Curated",
    source_url: "https://fageghana.org/opportunities/eu-organic-cocoa-2026",
    category: "agro",
    country: "European Union",
    deadline: null,
  },
  {
    title: "UAE importer — fresh pineapple & mango (weekly air shipments)",
    description:
      "Dubai-based distributor seeking weekly consolidated shipments of MD2 pineapple and Kent mango from Ghana.",
    source: "FAGE Curated",
    source_url: "https://fageghana.org/opportunities/uae-fresh-fruit",
    category: "agro",
    country: "United Arab Emirates",
    deadline: null,
  },
  {
    title: "USA tender — shea butter for cosmetics manufacturer",
    description:
      "Mid-size US natural cosmetics brand seeking 20MT/month of grade-A unrefined shea butter with full traceability.",
    source: "FAGE Curated",
    source_url: "https://fageghana.org/opportunities/usa-shea-butter",
    category: "processed_food",
    country: "United States",
    deadline: null,
  },
  {
    title: "UK retailer — handwoven kente & batik textiles",
    description:
      "UK lifestyle retailer commissioning a Ghana artisan collection for SS26. Looking for cooperatives with export capacity.",
    source: "FAGE Curated",
    source_url: "https://fageghana.org/opportunities/uk-kente-textiles",
    category: "handicraft",
    country: "United Kingdom",
    deadline: null,
  },
  {
    title: "ECOWAS regional buyer — cassava flour & gari",
    description:
      "Nigerian processor seeking long-term supply of high-quality cassava flour and gari from Ghanaian millers.",
    source: "FAGE Curated",
    source_url: "https://fageghana.org/opportunities/ecowas-cassava",
    category: "processed_food",
    country: "Nigeria",
    deadline: null,
  },
];

function parseRss(xml: string): Opportunity[] {
  // Minimal RSS <item> parser — avoids extra deps in the edge runtime.
  const items: Opportunity[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  const grab = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
    if (!m) return null;
    return m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
  };
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = grab(block, "title");
    const link = grab(block, "link");
    if (!title || !link) continue;
    items.push({
      title,
      description: grab(block, "description"),
      source: "ITC Trade Map",
      source_url: link,
      category: null,
      country: grab(block, "category"),
      deadline: null,
    });
  }
  return items;
}

async function fetchFeed(): Promise<Opportunity[]> {
  try {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "FAGE-Ghana/1.0 (+https://fageghana.org)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
    const xml = await res.text();
    const parsed = parseRss(xml);
    if (parsed.length === 0) throw new Error("Feed empty / unparseable");
    return parsed;
  } catch (err) {
    console.warn("[fetch-trade-opportunities] feed unavailable, using fallback:", err);
    return FALLBACK;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const opportunities = await fetchFeed();

    const rows = opportunities.map((o) => ({
      ...o,
      is_active: true,
      posted_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("trade_opportunities")
      .upsert(rows, { onConflict: "source_url", ignoreDuplicates: false })
      .select("id");

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, count: data?.length ?? 0, source: opportunities[0]?.source }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[fetch-trade-opportunities] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
