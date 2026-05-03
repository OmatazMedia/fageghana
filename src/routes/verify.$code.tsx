import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify/$code")({
  head: () => ({ meta: [{ title: "Verify Certificate — FAGE Ghana" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { code } = Route.useParams();
  const [cert, setCert] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.from("certificates").select("*").eq("verification_code", code).maybeSingle()
      .then(({ data }) => { setCert(data); setLoading(false); });
  }, [code]);

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</div>;

  const valid = cert && !cert.revoked && new Date(cert.expires_at) > new Date();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-card p-8 text-center shadow-lg">
        {!cert ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Certificate not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">The verification code <code className="font-mono">{code}</code> does not match any issued certificate.</p>
          </>
        ) : valid ? (
          <>
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
            <h1 className="mt-4 text-2xl font-bold">Authentic Certificate</h1>
            <div className="mt-6 space-y-2 text-left text-sm">
              <Row label="Holder" value={cert.full_name} />
              <Row label="Member ID" value={cert.member_id} />
              <Row label="Tier" value={<span className="capitalize">{cert.tier}</span>} />
              <Row label="Issued" value={new Date(cert.issued_at).toLocaleDateString()} />
              <Row label="Expires" value={new Date(cert.expires_at).toLocaleDateString()} />
              <Row label="Code" value={<span className="font-mono text-xs">{cert.verification_code}</span>} />
            </div>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-16 w-16 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">{cert.revoked ? "Certificate Revoked" : "Certificate Expired"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{cert.full_name} · {cert.member_id}</p>
            <p className="mt-1 text-xs text-muted-foreground">Expired on {new Date(cert.expires_at).toLocaleDateString()}</p>
          </>
        )}
        <Link to="/" className="mt-8 inline-block text-sm text-primary hover:underline">← Back to FAGE Ghana</Link>
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
