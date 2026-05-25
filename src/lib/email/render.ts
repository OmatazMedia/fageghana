// Block schema + renderer for the drag-and-drop email editor.
// Safe to import from client (editor) and server (sender) — pure functions.
import { emailTheme as t } from "./theme";

export type Block =
  | { id: string; type: "heading"; text: string; align?: "left" | "center" | "right" }
  | { id: string; type: "text"; text: string; align?: "left" | "center" | "right" }
  | {
      id: string;
      type: "image";
      url: string;
      alt?: string;
      width?: number;
      align?: "left" | "center" | "right";
    }
  | { id: string; type: "button"; text: string; url: string; align?: "left" | "center" | "right" }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height?: number };

export function interpolate(
  input: string,
  vars: Record<string, string | number | undefined | null>,
): string {
  return (input || "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

function esc(s: string): string {
  // light escape — we still allow simple inline markup like <strong>, <br/> in content
  return s;
}

function renderBlockHtml(b: Block, vars: Record<string, any>): string {
  switch (b.type) {
    case "heading":
      return `<tr><td style="padding:8px 0;text-align:${b.align ?? "left"};">
        <h1 style="margin:0;font-size:24px;line-height:1.3;color:${t.text};font-weight:700;">${esc(interpolate(b.text, vars))}</h1>
      </td></tr>`;
    case "text":
      return `<tr><td style="padding:8px 0;text-align:${b.align ?? "left"};">
        <p style="margin:0;font-size:15px;line-height:1.6;color:${t.text};">${interpolate(b.text, vars)}</p>
      </td></tr>`;
    case "image": {
      const url = interpolate(b.url, vars);
      if (!url) return "";
      return `<tr><td style="padding:12px 0;text-align:${b.align ?? "center"};">
        <img src="${url}" alt="${esc(b.alt ?? "")}" style="max-width:${b.width ?? 480}px;width:100%;height:auto;border-radius:8px;border:0;" />
      </td></tr>`;
    }
    case "button": {
      const url = interpolate(b.url, vars);
      const text = interpolate(b.text, vars);
      return `<tr><td style="padding:16px 0;text-align:${b.align ?? "center"};">
        <a href="${url}" style="display:inline-block;background:${t.primary};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9999px;font-weight:600;font-size:14px;">${esc(text)}</a>
      </td></tr>`;
    }
    case "divider":
      return `<tr><td style="padding:12px 0;"><hr style="border:0;border-top:1px solid ${t.border};margin:0;" /></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${b.height ?? 20}px;line-height:${b.height ?? 20}px;font-size:0;">&nbsp;</td></tr>`;
  }
}

export function renderEmail(
  blocks: Block[],
  vars: Record<string, any> = {},
): { html: string; text: string } {
  const inner = (blocks || []).map((b) => renderBlockHtml(b, vars)).join("");
  const html = `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${t.background};font-family:${t.fontFamily};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.background};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:${t.card};border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <tr><td style="background:${t.primary};padding:20px 24px;text-align:center;">
          <img src="${t.logoUrl}" alt="${t.orgShort}" style="height:36px;width:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${inner}
          </table>
        </td></tr>
        <tr><td style="background:#fafafa;padding:18px 24px;text-align:center;border-top:1px solid ${t.border};">
          <p style="margin:0;font-size:12px;color:${t.muted};line-height:1.5;">
            © ${new Date().getFullYear()} ${t.orgName}<br/>
            ${t.footerAddress}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  // Plain-text fallback
  const text = (blocks || [])
    .map((b) => {
      if (b.type === "heading" || b.type === "text")
        return interpolate(b.text, vars).replace(/<[^>]+>/g, "");
      if (b.type === "button") return `${interpolate(b.text, vars)}: ${interpolate(b.url, vars)}`;
      if (b.type === "divider") return "—";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");

  return { html, text };
}
