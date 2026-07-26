// Google Drive upload adapter. Server-only.
import { createSign } from "node:crypto";

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: { client_email: string; private_key: string; token_uri?: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch(sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google token exchange failed [${res.status}]: ${body}`);
  const parsed = JSON.parse(body) as { access_token?: string };
  if (!parsed.access_token) throw new Error("No access token returned by Google");
  return parsed.access_token;
}

export async function uploadToGoogleDrive(
  config: Record<string, any>,
  filename: string,
  bytes: Uint8Array,
): Promise<{ ok: true; external_id: string; url: string } | { ok: false; message: string }> {
  try {
    const sa =
      typeof config.service_account_json === "string"
        ? JSON.parse(config.service_account_json)
        : config.service_account_json;
    if (!sa?.client_email || !sa?.private_key) {
      return { ok: false, message: "Service account JSON missing client_email/private_key." };
    }
    const token = await getAccessToken(sa);
    const metadata: any = { name: filename };
    if (config.folder_id) metadata.parents = [String(config.folder_id)];

    const boundary = "-----lovable-boundary-" + Math.random().toString(36).slice(2);
    const pre = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
        metadata,
      )}\r\n--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
      "utf8",
    );
    const post = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = new Uint8Array(pre.length + bytes.length + post.length);
    body.set(pre, 0);
    body.set(bytes, pre.length);
    body.set(post, pre.length + bytes.length);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      },
    );
    const txt = await res.text();
    if (!res.ok) return { ok: false, message: `Drive upload [${res.status}]: ${txt}` };
    const parsed = JSON.parse(txt) as { id?: string; webViewLink?: string };
    if (!parsed.id) return { ok: false, message: "Drive upload returned no id" };
    return {
      ok: true,
      external_id: parsed.id,
      url: parsed.webViewLink || `https://drive.google.com/file/d/${parsed.id}/view`,
    };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
}
