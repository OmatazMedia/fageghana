import QRCodeStyling from "qr-code-styling";

export type FieldStyle = {
  x: number;
  y: number;
  fontSize: number;
  font: string;
  weight: string;
  color: string;
  align: "left" | "center" | "right";
  visible: boolean;
};

export type QrStyle = {
  x: number;
  y: number;
  size: number;
  dotType: "square" | "rounded" | "dots" | "classy" | "extra-rounded";
  fgColor: string;
  bgColor: string;
  border: number;
  borderColor: string;
  logoUrl?: string | null;
  logoSize: number;
};

export type SignatureStyle = { x: number; y: number; w: number; h: number };

export type TemplateLayout = {
  canvas: { w: number; h: number };
  fields: Record<string, FieldStyle>;
  qr: QrStyle;
  signature: SignatureStyle;
  authorizedNameStyle?: FieldStyle;
  verification_display?: string[];
};

export const FIELD_KEYS = [
  "name",
  "member_id",
  "tier",
  "issued",
  "expires",
  "authorized_name",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Member name",
  member_id: "Member ID",
  tier: "Tier",
  issued: "Issue date",
  expires: "Expiry date",
  authorized_name: "Authorized signer",
};

export function defaultLayout(): TemplateLayout {
  return {
    canvas: { w: 1414, h: 1000 },
    fields: {
      name: {
        x: 707,
        y: 480,
        fontSize: 64,
        font: "'Playfair Display', serif",
        weight: "700",
        color: "#1a1a1a",
        align: "center",
        visible: true,
      },
      member_id: {
        x: 707,
        y: 560,
        fontSize: 28,
        font: "'Inter', sans-serif",
        weight: "500",
        color: "#444",
        align: "center",
        visible: true,
      },
      tier: {
        x: 707,
        y: 610,
        fontSize: 22,
        font: "'Inter', sans-serif",
        weight: "600",
        color: "#666",
        align: "center",
        visible: true,
      },
      issued: {
        x: 350,
        y: 880,
        fontSize: 18,
        font: "'Inter', sans-serif",
        weight: "500",
        color: "#333",
        align: "center",
        visible: true,
      },
      expires: {
        x: 1064,
        y: 880,
        fontSize: 18,
        font: "'Inter', sans-serif",
        weight: "500",
        color: "#333",
        align: "center",
        visible: true,
      },
      authorized_name: {
        x: 707,
        y: 850,
        fontSize: 20,
        font: "'Inter', sans-serif",
        weight: "600",
        color: "#1a1a1a",
        align: "center",
        visible: true,
      },
    },
    qr: {
      x: 1200,
      y: 800,
      size: 160,
      dotType: "rounded",
      fgColor: "#000000",
      bgColor: "#ffffff",
      border: 0,
      borderColor: "#000000",
      logoUrl: null,
      logoSize: 0.3,
    },
    signature: { x: 600, y: 760, w: 220, h: 80 },
    verification_display: ["name", "member_id", "tier", "issued", "expires"],
  };
}

export function mergeLayout(stored: any): TemplateLayout {
  const def = defaultLayout();
  if (!stored || typeof stored !== "object") return def;
  return {
    canvas: { ...def.canvas, ...(stored.canvas ?? {}) },
    fields: { ...def.fields, ...(stored.fields ?? {}) },
    qr: { ...def.qr, ...(stored.qr ?? {}) },
    signature: { ...def.signature, ...(stored.signature ?? {}) },
    verification_display: stored.verification_display ?? def.verification_display,
  };
}

export function fieldValue(key: FieldKey, cert: any, template: any): string {
  switch (key) {
    case "name":
      return cert.full_name ?? "";
    case "member_id":
      return cert.member_id ?? "";
    case "tier":
      return String(cert.tier ?? "").toUpperCase();
    case "issued":
      return new Date(cert.issued_at).toLocaleDateString();
    case "expires":
      return new Date(cert.expires_at).toLocaleDateString();
    case "authorized_name":
      return template?.authorized_name ?? "FAGE President";
  }
}

export async function buildQrDataUrl(verifyUrl: string, qr: QrStyle): Promise<string> {
  const qrCode = new QRCodeStyling({
    width: qr.size,
    height: qr.size,
    type: "canvas",
    data: verifyUrl,
    image: qr.logoUrl ?? undefined,
    dotsOptions: { color: qr.fgColor, type: qr.dotType },
    backgroundOptions: { color: qr.bgColor },
    cornersSquareOptions: { color: qr.fgColor },
    cornersDotOptions: { color: qr.fgColor },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: qr.logoSize,
      margin: 4,
      crossOrigin: "anonymous",
    },
  });
  const blob = await qrCode.getRawData("png");
  if (!blob) throw new Error("QR generation failed");
  return await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.readAsDataURL(blob as Blob);
  });
}

export async function renderCertificate(canvas: HTMLCanvasElement, cert: any, template: any) {
  const layout = mergeLayout(template?.field_positions);
  const bg = await loadImage(template.image_url);
  const w = layout.canvas.w || bg.naturalWidth;
  const h = layout.canvas.h || bg.naturalHeight;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, w, h);

  // Signature
  if (template.signature_url) {
    try {
      const sig = await loadImage(template.signature_url);
      ctx.drawImage(
        sig,
        layout.signature.x,
        layout.signature.y,
        layout.signature.w,
        layout.signature.h,
      );
    } catch {}
  }

  // Fields
  for (const key of FIELD_KEYS) {
    const f = layout.fields[key];
    if (!f || !f.visible) continue;
    ctx.fillStyle = f.color;
    ctx.font = `${f.weight} ${f.fontSize}px ${f.font}`;
    ctx.textAlign = f.align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(fieldValue(key, cert, template), f.x, f.y);
  }

  // QR
  const verifyUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${cert.verification_code}`;
  const qrUrl = await buildQrDataUrl(verifyUrl, layout.qr);
  const qrImg = await loadImage(qrUrl);
  if (layout.qr.border > 0) {
    ctx.fillStyle = layout.qr.borderColor;
    ctx.fillRect(
      layout.qr.x - layout.qr.border,
      layout.qr.y - layout.qr.border,
      layout.qr.size + layout.qr.border * 2,
      layout.qr.size + layout.qr.border * 2,
    );
  }
  ctx.drawImage(qrImg, layout.qr.x, layout.qr.y, layout.qr.size, layout.qr.size);
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
