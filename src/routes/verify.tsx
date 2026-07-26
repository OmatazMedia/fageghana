import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Loader2,
  BadgeCheck,
  Building2,
  Calendar,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "Verify a Member — FAGE Ghana" },
      {
        name: "description",
        content: "Verify the membership status of any FAGE Ghana registered member or certificate.",
      },
    ],
  }),
  component: VerifyMemberPage,
});

type SearchMode = "member" | "certificate";
type MemberResult = {
  contact_name: string;
  company_name: string;
  member_id: string;
  tier: string;
  subscription_expiry: string | null;
};

function StatusBadge({ expiry }: { expiry: string | null }) {
  if (!expiry)
    return (
      <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        Inactive
      </span>
    );
  const active = new Date(expiry) > new Date();
  return active ? (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      Active Member
    </span>
  ) : (
    <span className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive">
      Expired
    </span>
  );
}

function VerifyMemberPage() {
  const [mode, setMode] = useState<SearchMode>("member");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [certResult, setCertResult] = useState<any | null | "not_found">(null);

  async function searchMember(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    setMembers([]);

    const q = query.trim();
    // Public search across name, company, member ID, and email via SECURITY DEFINER RPC
    const { data } = await supabase.rpc("public_search_members" as any, { _q: q });
    setMembers((data as MemberResult[]) ?? []);
    setSearched(true);
    setLoading(false);
  }

  async function searchCert(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    setCertResult(null);

    const { data: rows } = await supabase.rpc("verify_certificate" as any, { _code: query.trim() });
    const data = Array.isArray(rows) ? rows[0] : rows;

    setCertResult(data ?? "not_found");
    setSearched(true);
    setLoading(false);
  }

  function reset() {
    setQuery("");
    setSearched(false);
    setMembers([]);
    setCertResult(null);
  }

  const isActive = (expiry: string | null) => !!expiry && new Date(expiry) > new Date();

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-20 text-primary-foreground">
        <div className="absolute inset-0 bg-[url('/images/products/showcase/04-vegetables.jpeg')] bg-cover bg-center opacity-10" />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <Reveal variant="fade">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
          </Reveal>
          <Reveal variant="up" delay={1}>
            <h1 className="text-3xl font-bold md:text-4xl !text-white">
              Member Verification Portal
            </h1>
          </Reveal>
          <Reveal variant="up" delay={2}>
            <p className="mt-3 text-white/80">
              Confirm the membership status of any FAGE Ghana registered exporter. Search by name,
              company or member ID — or verify a certificate code.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Search card */}
      <section className="py-16">
        <div className="mx-auto max-w-2xl px-4">
          <Reveal variant="scale">
            <div className="rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Mode tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => {
                    setMode("member");
                    reset();
                  }}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "member" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  Search by Member
                </button>
                <button
                  onClick={() => {
                    setMode("certificate");
                    reset();
                  }}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "certificate" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}
                >
                  Verify Certificate Code
                </button>
              </div>

              <div className="p-6">
                <p className="mb-4 text-sm text-muted-foreground">
                  {mode === "member"
                    ? "Enter a member's name, company name or member ID to check their registration status."
                    : "Enter the unique verification code printed on a FAGE certificate to confirm its authenticity."}
                </p>

                <form
                  onSubmit={mode === "member" ? searchMember : searchCert}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={
                        mode === "member"
                          ? "Name, company or member ID…"
                          : "Certificate verification code…"
                      }
                      className="w-full rounded-xl border border-input bg-background py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition cursor-pointer"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                  </button>
                </form>

                {/* Results */}
                {searched && !loading && (
                  <div className="mt-6">
                    {/* Member search results */}
                    {mode === "member" &&
                      (members.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10 text-center">
                          <XCircle className="h-10 w-10 text-muted-foreground/40" />
                          <p className="text-sm font-semibold text-foreground">No member found</p>
                          <p className="text-xs text-muted-foreground">
                            No registered FAGE member matches "
                            <span className="font-medium">{query}</span>".
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            {members.length} result{members.length !== 1 ? "s" : ""} found
                          </p>
                          {members.map((m, i) => (
                            <div
                              key={i}
                              className={`rounded-xl border p-4 ${isActive(m.subscription_expiry) ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-muted/30"}`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {isActive(m.subscription_expiry) ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                                    )}
                                    <span className="font-semibold text-foreground">
                                      {m.contact_name || "—"}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pl-6">
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" /> {m.company_name || "—"}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <BadgeCheck className="h-3 w-3" /> {m.member_id}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Award className="h-3 w-3" />{" "}
                                      <span className="capitalize">{m.tier}</span>
                                    </span>
                                    {m.subscription_expiry && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" /> Expires{" "}
                                        {new Date(m.subscription_expiry).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <StatusBadge expiry={m.subscription_expiry} />
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}

                    {/* Certificate verification result */}
                    {mode === "certificate" &&
                      (certResult === "not_found" ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 py-10 text-center">
                          <XCircle className="h-12 w-12 text-destructive" />
                          <p className="text-sm font-semibold">Certificate not found</p>
                          <p className="text-xs text-muted-foreground">
                            The code "<span className="font-mono font-medium">{query}</span>" does
                            not match any issued FAGE certificate.
                          </p>
                        </div>
                      ) : (
                        certResult &&
                        (() => {
                          const valid =
                            !certResult.revoked && new Date(certResult.expires_at) > new Date();
                          return (
                            <div
                              className={`rounded-xl border p-6 text-center ${valid ? "border-emerald-200 bg-emerald-50/50" : "border-destructive/20 bg-destructive/5"}`}
                            >
                              {valid ? (
                                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                              ) : (
                                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                              )}
                              <h3
                                className={`mt-3 text-lg font-bold ${valid ? "text-emerald-700" : "text-destructive"}`}
                              >
                                {valid
                                  ? "Authentic & Active"
                                  : certResult.revoked
                                    ? "Certificate Revoked"
                                    : "Certificate Expired"}
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> Verified by FAGE Ghana
                              </p>
                              <div className="mt-4 space-y-2 text-left text-sm border-t border-border pt-4">
                                <Row label="Name" value={certResult.full_name} />
                                <Row label="Member ID" value={certResult.member_id} />
                                <Row
                                  label="Tier"
                                  value={<span className="capitalize">{certResult.tier}</span>}
                                />
                                <Row
                                  label="Issued"
                                  value={new Date(certResult.issued_at).toLocaleDateString()}
                                />
                                <Row
                                  label="Expires"
                                  value={new Date(certResult.expires_at).toLocaleDateString()}
                                />
                              </div>
                              {valid && (
                                <Link
                                  to="/verify/$code"
                                  params={{ code: certResult.verification_code }}
                                  className="mt-4 inline-block text-xs text-primary hover:underline"
                                >
                                  View full certificate verification page →
                                </Link>
                              )}
                            </div>
                          );
                        })()
                      ))}
                  </div>
                )}
              </div>
            </div>
          </Reveal>

          {/* Trust note */}
          <Reveal variant="fade" delay={1}>
            <div className="mt-8 rounded-xl bg-muted/40 p-5 text-center text-xs text-muted-foreground">
              <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-primary" />
              This portal is maintained by the Federation of Associations of Ghanaian Exporters
              (FAGE). Only registered and verified members appear in search results. For enquiries
              contact{" "}
              <a href="mailto:info@fageghana.com" className="text-primary hover:underline">
                info@fageghana.com
              </a>
              .
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
