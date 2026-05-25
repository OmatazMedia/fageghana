import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Download, ArrowLeft, FileText } from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { renderCertificate } from "@/lib/certificate-render";

export const Route = createFileRoute("/certificate/$id")({
  head: () => ({ meta: [{ title: "Certificate — FAGE Ghana" }] }),
  component: CertificatePage,
});

function CertificatePage() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<any | null>(null);
  const [template, setTemplate] = useState<any | null>(null);
  const [error, setError] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase
        .from("certificates")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!c) {
        setError("Certificate not found");
        return;
      }
      setCert(c);
      let tpl: any = null;
      if (c.template_id) {
        const { data } = await supabase
          .from("certificate_templates")
          .select("*")
          .eq("id", c.template_id)
          .maybeSingle();
        tpl = data;
      }
      if (!tpl) {
        const { data } = await supabase
          .from("certificate_templates")
          .select("*")
          .eq("tier", c.tier)
          .eq("is_active", true)
          .maybeSingle();
        tpl = data;
      }
      if (!tpl) setError("No template configured for this tier");
      setTemplate(tpl);
    })();
  }, [id]);

  useEffect(() => {
    if (!cert || !template || !canvasRef.current) return;
    setReady(false);
    renderCertificate(canvasRef.current, cert, template)
      .then(() => setReady(true))
      .catch((e) => setError(e.message));
  }, [cert, template]);

  function downloadPng() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `FAGE-${cert.member_id}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  function downloadPdf() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const w = canvasRef.current.width,
      h = canvasRef.current.height;
    const pdf = new jsPDF({
      orientation: w >= h ? "landscape" : "portrait",
      unit: "px",
      format: [w, h],
    });
    pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
    pdf.save(`FAGE-${cert.member_id}.pdf`);
  }

  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center text-muted-foreground p-6">
        <p>{error}</p>
        <Link to="/dashboard" className="text-sm text-primary hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  if (!cert || !template)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
      </div>
    );

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to dashboard
          </Link>
          <div className="flex gap-2">
            <button
              disabled={!ready}
              onClick={downloadPng}
              className="flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              <Download className="h-4 w-4" /> PNG
            </button>
            <button
              disabled={!ready}
              onClick={downloadPdf}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              <FileText className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-auto rounded-2xl bg-card p-4 shadow-sm">
          <canvas ref={canvasRef} className="mx-auto max-w-full h-auto" />
        </div>
      </div>
    </div>
  );
}
