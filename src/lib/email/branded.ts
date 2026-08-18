import { emailTheme as t } from "./theme";

function esc(s: string) {
  return String(s ?? "").replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

export type BrandedEmail = {
  title: string;
  /** Paragraphs of body copy (plain text, escaped). */
  paragraphs?: string[];
  /** Label → value rows rendered as a details table. */
  rows?: { label: string; value: string }[];
  ctaLabel?: string;
  ctaHref?: string;
  footNote?: string;
};

/** Builds a mobile-responsive, branded HTML + text email (header, body, footer). */
export function brandedEmail(input: BrandedEmail): { html: string; text: string } {
  const paras = (input.paragraphs ?? [])
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${t.text}">${esc(p)}</p>`,
    )
    .join("");

  const rows = (input.rows ?? [])
    .map(
      (r) =>
        `<tr><td style="padding:8px 0;font-size:13px;color:${t.muted};width:42%">${esc(r.label)}</td>` +
        `<td style="padding:8px 0;font-size:13px;color:${t.text};font-weight:600">${esc(r.value)}</td></tr>`,
    )
    .join("");

  const cta =
    input.ctaLabel && input.ctaHref
      ? `<div style="margin:22px 0 6px"><a href="${esc(input.ctaHref)}" style="display:inline-block;background:${t.primary};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px">${esc(input.ctaLabel)}</a></div>`
      : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(input.title)}</title></head>
<body style="margin:0;padding:0;background:${t.background};font-family:${t.fontFamily}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.background};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${t.card};border:1px solid ${t.border};border-radius:14px;overflow:hidden">
        <tr><td style="background:${t.primary};padding:18px 24px" align="left">
          <img src="${t.logoUrl}" alt="${esc(t.orgShort)}" height="40" style="height:40px;display:block;border:0"/>
        </td></tr>
        <tr><td style="padding:26px 24px">
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:${t.primaryDark}">${esc(input.title)}</h1>
          ${paras}
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;border-top:1px solid ${t.border}">${rows}</table>` : ""}
          ${cta}
          ${input.footNote ? `<p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:${t.muted}">${esc(input.footNote)}</p>` : ""}
        </td></tr>
        <tr><td style="background:${t.background};padding:16px 24px;border-top:1px solid ${t.border}">
          <p style="margin:0;font-size:12px;color:${t.muted}">${esc(t.orgName)}<br/>${esc(t.footerAddress)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    input.title,
    "",
    ...(input.paragraphs ?? []),
    ...(input.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    input.ctaHref ? `${input.ctaLabel}: ${input.ctaHref}` : "",
    input.footNote ?? "",
    "",
    t.orgName,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}
