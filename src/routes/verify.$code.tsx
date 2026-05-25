import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FIELD_LABELS, mergeLayout, type FieldKey } from "@/lib/certificate-render";

export const Route = createFileRoute("/verify/$code")({
  head: () => ({ meta: [{ title: "Verify Certificate — FAGE Ghana" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const [cert, setCert] = useState<any | null>(null);
  const [template, setTemplate] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: rows } = await supabase.rpc("verify_certificate" as any, { _code: code });
      const data = Array.isArray(rows) ? rows[0] : rows;
      setCert(data);
      if (data?.template_id) {
        const { data: t } = await supabase
          .from("certificate_templates")
          .select("*")
          .eq("id", data.template_id)
          .maybeSingle();
        setTemplate(t);
      }
      setLoading(false);
    })();
  }, [code]);

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Verifying…
      </div>
    );

  const valid = cert && !cert.revoked && new Date(cert.expires_at) > new Date();
  const visible = (mergeLayout(template?.field_positions).verification_display ?? [
    "name",
    "member_id",
    "tier",
    "issued",
    "expires",
  ]) as FieldKey[];

  const valueFor = (k: FieldKey) => {
    if (!cert) return "";
    switch (k) {
      case "name":
        return cert.full_name;
      case "member_id":
        return cert.member_id;
      case "tier":
        return String(cert.tier).toUpperCase();
      case "issued":
        return new Date(cert.issued_at).toLocaleDateString();
      case "expires":
        return new Date(cert.expires_at).toLocaleDateString();
      default:
        return "";
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center shadow-lg">
        {!cert ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Certificate not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The code <code className="font-mono">{code}</code> does not match any issued
              certificate.
            </p>
          </>
        ) : valid ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h1 className="mt-4 text-2xl font-bold text-emerald-700">Authentic — Active</h1>
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Verified by FAGE Ghana
            </p>
            <div className="mt-6 space-y-2 text-left text-sm">
              {visible.map((k) => (
                <Row key={k} label={FIELD_LABELS[k] ?? k} value={valueFor(k)} />
              ))}
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">
              {cert.revoked ? "Certificate Revoked" : "Certificate Expired"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {cert.full_name} · {cert.member_id}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Expired on {new Date(cert.expires_at).toLocaleDateString()}
            </p>
          </>
        )}
        <Link to="/" className="mt-8 inline-block text-sm text-primary hover:underline">
          ← Back to FAGE Ghana
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between border-b border-border py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
