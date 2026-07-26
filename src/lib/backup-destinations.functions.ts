import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSign } from "node:crypto";

/** Base64url without padding. */
function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

/** Sign a Google service-account JWT and exchange it for an access token. */
async function getGoogleAccessToken(saJson: {
  client_email: string;
  private_key: string;
  token_uri?: string;
}, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: saJson.client_email,
    scope,
    aud: saJson.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = b64url(signer.sign(saJson.private_key));
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(saJson.token_uri || "https://oauth2.googleapis.com/token", {
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

type TestInput = {
  provider: "google_drive" | "aws_s3" | "dropbox" | "sftp" | "webhook";
  config: Record<string, any>;
};

export const testBackupDestination = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TestInput) => input)
  .handler(async ({ data, context }) => {
    // Only admins/superadmins may test.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin" as any,
    });
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "superadmin" as any,
    });
    if (!isAdmin && !isSuper) throw new Error("Forbidden");

    const { provider, config } = data;

    if (provider === "google_drive") {
      let sa: any;
      try {
        sa = typeof config.service_account_json === "string"
          ? JSON.parse(config.service_account_json)
          : config.service_account_json;
      } catch {
        return { ok: false, message: "Service account JSON is not valid JSON." };
      }
      if (!sa?.client_email || !sa?.private_key) {
        return { ok: false, message: "Service account JSON must include client_email and private_key." };
      }
      try {
        const token = await getGoogleAccessToken(sa, "https://www.googleapis.com/auth/drive.file");
        // Verify token by hitting the About endpoint.
        const about = await fetch(
          "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName),storageQuota(limit,usage)",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const aboutBody = await about.text();
        if (!about.ok) return { ok: false, message: `Drive API [${about.status}]: ${aboutBody}` };
        const info = JSON.parse(aboutBody);

        // If folder_id provided, verify it exists and is accessible.
        if (config.folder_id) {
          const folder = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(config.folder_id))}?fields=id,name,mimeType&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (!folder.ok) {
            const t = await folder.text();
            return {
              ok: false,
              message: `Folder not accessible: ${t}. Share the folder with ${sa.client_email} as Editor.`,
            };
          }
        }
        return {
          ok: true,
          message: `Connected as ${info.user?.emailAddress ?? sa.client_email}${
            config.folder_id ? " (folder verified)" : ""
          }`,
        };
      } catch (e: any) {
        return { ok: false, message: e?.message ?? "Unknown error" };
      }
    }

    return {
      ok: false,
      message: `Provider "${provider}" testing is not implemented yet. Save the destination and it will be picked up once its adapter is added.`,
    };
  });
