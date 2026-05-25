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

export type Signer = {
  id: string;
  label: string; // admin-only ("CEO", "President") — not shown on cert
  name: string; // shown on cert under the signature
  signature_url: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  nameOffsetY: number;
  nameFontSize: number;
  nameFontFamily: string;
  nameFontWeight: string;
  nameColor: string;
  visible: boolean;
};

export type TemplateLayout = {
  canvas: { w: number; h: number };
  fields: Record<string, FieldStyle>;
  qr: QrStyle;
  signature: SignatureStyle;
  authorizedNameStyle?: FieldStyle;
  verification_display?: string[];
  dateFormat?: string;
};

export const DATE_FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: "D MMMM YYYY", label: "5 March 2027" },
  { value: "Do MMM YYYY", label: "5th Mar 2027" },
  { value: "Do MMMM YYYY", label: "5th March 2027" },
  { value: "D MMM YYYY", label: "5 Mar 2027" },
  { value: "MMMM D, YYYY", label: "March 5, 2027" },
  { value: "MMM D, YYYY", label: "Mar 5, 2027" },
  { value: "DD/MM/YYYY", label: "05/03/2027" },
  { value: "MM/DD/YYYY", label: "03/05/2027" },
  { value: "YYYY-MM-DD", label: "2027-03-05" },
];

const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatCertDate(input: string | Date, fmt = "D MMMM YYYY"): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "";
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  return fmt
    .replace(/YYYY/g, String(year))
    .replace(/MMMM/g, MONTHS_LONG[month])
    .replace(/MMM/g, MONTHS_SHORT[month])
    .replace(/MM/g, String(month + 1).padStart(2, "0"))
    .replace(/DD/g, String(day).padStart(2, "0"))
    .replace(/Do/g, ordinal(day))
    .replace(/D/g, String(day));
}

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
        visible: false,
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
    dateFormat: "D MMMM YYYY",
  };
}

export function defaultSigner(partial: Partial<Signer> = {}): Signer {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    label: "Primary",
    name: "FAGE President",
    signature_url: null,
    x: 600,
    y: 760,
    w: 220,
    h: 80,
    nameOffsetY: 36,
    nameFontSize: 20,
    nameFontFamily: "'Inter', sans-serif",
    nameFontWeight: "600",
    nameColor: "#1a1a1a",
    visible: true,
    ...partial,
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

/** Normalize signers array from template row, falling back to legacy single signer. */
export function normalizeSigners(template: any): Signer[] {
  const raw = template?.signers;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((s: any) => ({ ...defaultSigner(), ...s }));
  }
  // legacy fallback
  const layout = mergeLayout(template?.field_positions);
  if (template?.signature_url || template?.authorized_name) {
    return [
      defaultSigner({
        label: "Primary",
        name: template.authorized_name ?? "FAGE President",
        signature_url: template.signature_url ?? null,
        x: layout.signature.x,
        y: layout.signature.y,
        w: layout.signature.w,
        h: layout.signature.h,
      }),
    ];
  }
  return [];
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

async function ensureFontsLoaded(layout: TemplateLayout, signers: Signer[]) {
  if (typeof document === "undefined" || !(document as any).fonts) return;
  const families = new Set<string>();
  for (const k of FIELD_KEYS) {
    const f = layout.fields[k];
    if (f) families.add(`${f.weight} ${f.fontSize}px ${f.font}`);
  }
  for (const s of signers) {
    families.add(`${s.nameFontWeight} ${s.nameFontSize}px ${s.nameFontFamily}`);
  }
  try {
    await Promise.all(
      Array.from(families).map((spec) => (document as any).fonts.load(spec).catch(() => null)),
    );
    await (document as any).fonts.ready;
  } catch {
    /* ignore */
  }
}

export async function renderCertificate(canvas: HTMLCanvasElement, cert: any, template: any) {
  const layout = mergeLayout(template?.field_positions);
  const signers = normalizeSigners(template);
  await ensureFontsLoaded(layout, signers);

  const bg = await loadImage(template.image_url);
  // Always use layout canvas — positions are stored in this coordinate space.
  const w = layout.canvas.w;
  const h = layout.canvas.h;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, w, h);

  // Signers
  for (const s of signers) {
    if (!s.visible) continue;
    if (s.signature_url) {
      try {
        const sig = await loadImage(s.signature_url);
        drawContain(ctx, sig, s.x, s.y, s.w, s.h);
      } catch {
        /* ignore broken signature */
      }
    }
    if (s.name) {
      ctx.fillStyle = s.nameColor;
      ctx.font = `${s.nameFontWeight} ${s.nameFontSize}px ${s.nameFontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(s.name, s.x + s.w / 2, s.y + s.h + s.nameOffsetY - s.nameFontSize);
    }
  }

  // Fields — match preview's translate(0,-100%) → baseline = bottom
  for (const key of FIELD_KEYS) {
    const f = layout.fields[key];
    if (!f || !f.visible) continue;
    if (key === "authorized_name" && signers.length > 0) continue; // signers replace legacy
    ctx.fillStyle = f.color;
    ctx.font = `${f.weight} ${f.fontSize}px ${f.font}`;
    ctx.textAlign = f.align;
    ctx.textBaseline = "bottom";
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

function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ar = img.naturalWidth / img.naturalHeight;
  const boxAr = w / h;
  let dw = w,
    dh = h;
  if (ar > boxAr) {
    dh = w / ar;
  } else {
    dw = h * ar;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
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
