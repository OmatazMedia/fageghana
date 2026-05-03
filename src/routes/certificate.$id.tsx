import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, Download, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/certificate/$id")({
  head: () => ({ meta: [{ title: "Certificate — FAGE Ghana" }] }),
  component: CertificatePage,
});

function CertificatePage() {
  const { id } = Route.useParams();
  const [cert, setCert] = useState<any | null>(null);
  const [template, setTemplate] = useState<any | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data: c } = await supabase.from("certificates").select("*").eq("id", id).maybeSingle();
      if (c) {
        setCert(c);
        if (c.template_id) {
          const { data: t } = await supabase.from("certificate_templates").select("*").eq("id", c.template_id).maybeSingle();
          setTemplate(t);
        }
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!cert || !template || !canvasRef.current) return;
    void renderCert(canvasRef.current, cert, template).then(() => setReady(true));
  }, [cert, template]);

  function download() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `FAGE-Certificate-${cert.member_id}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  if (!cert) return <div className="flex min-h-screen items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to dashboard</Link>
          <button disabled={!ready} onClick={download} className="flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <Download className="h-4 w-4" /> Download PNG
          </button>
        </div>
        {!template ? (
          <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">No template configured for this certificate yet. Please contact admin.</div>
        ) : (
          <div className="overflow-auto rounded-2xl bg-card p-4 shadow-sm">
            <canvas ref={canvasRef} className="mx-auto max-w-full h-auto" />
          </div>
        )}
      </div>
    </div>
  );
}

async function renderCert(canvas: HTMLCanvasElement, cert: any, template: any) {
  const bg = await loadImage(template.image_url);
  canvas.width = bg.naturalWidth;
  canvas.height = bg.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0);

  const pos = (template.field_positions ?? {}) as Record<string, any>;
  const draw = (key: string, text: string) => {
    const p = pos[key];
    if (!p) return;
    ctx.fillStyle = p.color ?? "#1a1a1a";
    ctx.font = `${p.weight ?? "bold"} ${p.fontSize ?? 36}px ${p.font ?? "serif"}`;
    ctx.textAlign = p.align ?? "center";
    ctx.fillText(text, p.x, p.y);
  };

  draw("name", cert.full_name);
  draw("member_id", cert.member_id);
  draw("tier", cert.tier.toUpperCase());
  draw("issued", new Date(cert.issued_at).toLocaleDateString());
  draw("expires", new Date(cert.expires_at).toLocaleDateString());

  if (template.signature_url && pos.signature) {
    const sig = await loadImage(template.signature_url);
    ctx.drawImage(sig, pos.signature.x, pos.signature.y, pos.signature.w ?? 200, pos.signature.h ?? 80);
  }

  // QR code
  const verifyUrl = `${window.location.origin}/verify/${cert.verification_code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 256 });
  const qr = await loadImage(qrDataUrl);
  const qrPos = pos.qr ?? { x: canvas.width - 200, y: canvas.height - 200, size: 160 };
  ctx.drawImage(qr, qrPos.x, qrPos.y, qrPos.size ?? 160, qrPos.size ?? 160);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
