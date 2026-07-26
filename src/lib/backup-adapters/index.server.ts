// Dispatches an upload to the correct provider adapter.
import { uploadToGoogleDrive } from "./google-drive.server";

export type UploadResult =
  | { ok: true; external_id: string; url: string }
  | { ok: false; message: string };

export async function uploadToDestination(
  provider: string,
  config: Record<string, any>,
  filename: string,
  bytes: Uint8Array,
): Promise<UploadResult> {
  switch (provider) {
    case "google_drive":
      return uploadToGoogleDrive(config, filename, bytes);
    default:
      return { ok: false, message: `Adapter for "${provider}" not implemented yet.` };
  }
}
