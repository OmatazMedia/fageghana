import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Phone, MapPin, Globe, Building2, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  renderCustomFieldValue,
  type CustomFieldDef,
} from "@/components/admin/DynamicFieldRenderer";

export const Route = createFileRoute("/directory/$slug")({
  head: ({ loaderData }) => {
    const e: any = loaderData;
    if (!e) return { meta: [{ title: "Directory entry — FAGE Ghana" }] };
    return {
      meta: [
        { title: `${e.company_name} — FAGE Directory` },
        { name: "description", content: e.short_description ?? `Profile of ${e.company_name}.` },
        { property: "og:title", content: e.company_name },
        { property: "og:description", content: e.short_description ?? "" },
        ...(e.logo_url ? [{ property: "og:image", content: e.logo_url }] : []),
      ],
    };
  },
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("directory_entries")
      .select("*")
      .eq("slug", params.slug)
      .eq("published", true)
      .eq("status", "approved")
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data) throw notFound();
    return data;
  },
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return (
      <SiteLayout>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="text-2xl font-bold">Couldn't load this entry</h1>
          <button
            onClick={() => {
              reset();
              router.invalidate();
            }}
            className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </SiteLayout>
    );
  },
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Entry not found</h1>
        <Link to="/directory" className="mt-4 inline-block text-primary hover:underline">
          ← Back to directory
        </Link>
      </div>
    </SiteLayout>
  ),
  component: DetailPage,
});

function DetailPage() {
  const e = Route.useLoaderData() as any;
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [related, setRelated] = useState<any[]>([]);
  const [customDefs, setCustomDefs] = useState<CustomFieldDef[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate({
        to: "/login",
        search: { redirect: `/directory/${e?.slug ?? ""}` } as any,
        replace: true,
      });
    }
  }, [loading, user, navigate, e?.slug]);

  useEffect(() => {
    supabase
      .from("directory_custom_field_defs")
      .select("*")
      .eq("active", true)
      .order("display_order")
      .then(({ data }) =>
        setCustomDefs(
          (data ?? []).map((d: any) => ({ ...d, options: d.options ?? [] })) as CustomFieldDef[],
        ),
      );
  }, []);

  useEffect(() => {
    supabase
      .from("directory_entries")
      .select("id,slug,company_name,category,entry_type,logo_url")
      .eq("published", true)
      .eq("entry_type", e.entry_type)
      .neq("id", e.id)
      .limit(4)
      .then(({ data }) => setRelated(data ?? []));
  }, [e.id, e.entry_type]);

  const isAssoc = e.entry_type === "association";
  const executives: { role: string; name: string }[] = Array.isArray(e.executives)
    ? e.executives
    : [];

  if (loading || !user) {
    return (
      <SiteLayout>
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <article className="mx-auto max-w-4xl px-4 py-10">
        <Link
          to="/directory"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to directory
        </Link>

        <header className="mt-6 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-start">
          {e.logo_url ? (
            <img
              src={e.logo_url}
              alt={`${e.company_name} logo`}
              className="h-24 w-24 rounded-2xl object-cover"
            />
          ) : (
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-2xl text-2xl font-bold ${isAssoc ? "bg-primary/15 text-primary" : "bg-muted"}`}
            >
              {e.company_name
                .split(" ")
                .slice(0, 2)
                .map((s: string) => s[0])
                .join("")
                .toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isAssoc
                  ? "bg-primary/10 text-primary"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              }`}
            >
              {isAssoc ? <Users className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
              {isAssoc ? "Association" : "Corporate Member"}
            </span>
            <h1 className="mt-2 text-3xl font-bold">{e.company_name}</h1>
            {e.category && <p className="mt-1 text-muted-foreground">{e.category}</p>}
            {e.short_description && (
              <p className="mt-3 text-foreground/80">{e.short_description}</p>
            )}
          </div>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            {e.long_description && (
              <Section title="About">
                <p className="whitespace-pre-line text-foreground/80">{e.long_description}</p>
              </Section>
            )}
            {e.mission && (
              <Section title="Mission">
                <p className="text-foreground/80">{e.mission}</p>
              </Section>
            )}
            {e.vision && (
              <Section title="Vision">
                <p className="text-foreground/80">{e.vision}</p>
              </Section>
            )}
            {e.services?.length > 0 && (
              <Section title="Services">
                <ul className="list-disc space-y-1 pl-5 text-foreground/80">
                  {e.services.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </Section>
            )}
            {e.products?.length > 0 && (
              <Section title="Products">
                <div className="flex flex-wrap gap-2">
                  {e.products.map((p: string) => (
                    <span
                      key={p}
                      className="rounded-full bg-muted px-3 py-1 text-sm text-foreground/80"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Section>
            )}
            {executives.length > 0 && (
              <Section title="Executives">
                <ul className="space-y-1.5">
                  {executives.map((x, i) => (
                    <li key={i} className="flex justify-between border-b border-border py-2 text-sm last:border-0">
                      <span className="text-muted-foreground">{x.role}</span>
                      <span className="font-medium">{x.name}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {customDefs
              .filter(
                (d) =>
                  (d.applies_to === "both" || d.applies_to === e.entry_type) &&
                  e.custom_fields &&
                  e.custom_fields[d.key] !== undefined &&
                  e.custom_fields[d.key] !== null &&
                  e.custom_fields[d.key] !== "",
              )
              .map((d) => (
                <Section key={d.id} title={d.label}>
                  {renderCustomFieldValue(d, e.custom_fields[d.key])}
                </Section>
              ))}
          </div>


          <aside className="space-y-4">
            <Section title="Contact">
              <div className="space-y-2 text-sm">
                {e.contact_name && (
                  <p>
                    <span className="text-muted-foreground">Contact: </span>
                    <span className="font-medium">{e.contact_name}</span>
                  </p>
                )}
                {e.director_name && (
                  <p>
                    <span className="text-muted-foreground">Director: </span>
                    <span className="font-medium">{e.director_name}</span>
                  </p>
                )}
                {e.phone && (
                  <a
                    href={`tel:${e.phone.replace(/\s/g, "")}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Phone className="h-4 w-4" /> {e.phone}
                  </a>
                )}
                {e.email && (
                  <a
                    href={`mailto:${e.email}`}
                    className="flex items-center gap-2 break-all hover:text-primary"
                  >
                    <Mail className="h-4 w-4" /> {e.email}
                  </a>
                )}
                {e.website && (
                  <a
                    href={e.website.startsWith("http") ? e.website : `https://${e.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 break-all hover:text-primary"
                  >
                    <Globe className="h-4 w-4" /> {e.website}
                  </a>
                )}
                {(e.physical_address || e.postal_address) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      {e.physical_address && <p>{e.physical_address}</p>}
                      {e.postal_address && (
                        <p className="text-muted-foreground">{e.postal_address}</p>
                      )}
                      {e.region && <p className="text-muted-foreground">{e.region}</p>}
                      {e.country && <p className="text-muted-foreground">{e.country}</p>}
                    </div>
                  </div>
                )}
              </div>
            </Section>

            {related.length > 0 && (
              <Section title={isAssoc ? "Other associations" : "Other members"}>
                <ul className="space-y-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/directory/$slug"
                        params={{ slug: r.slug }}
                        className="block rounded-lg p-2 text-sm hover:bg-muted"
                      >
                        <p className="font-medium">{r.company_name}</p>
                        {r.category && (
                          <p className="text-xs text-muted-foreground">{r.category}</p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </aside>
        </div>
      </article>
    </SiteLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
