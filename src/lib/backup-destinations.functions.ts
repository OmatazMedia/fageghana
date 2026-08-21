// @ts-nocheck
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

type TestInput = {
  provider: "google_drive" | "aws_s3" | "dropbox" | "sftp" | "webhook";
  config: Record<string, any>;
};

export async function testBackupDestination(input: any): Promise<any> {
  const data = input?.data ?? input;
  const { provider, config } = data as TestInput;

  const { data: existing } = await api
    .from("backup_destinations")
    .select("id")
    .eq("provider", provider)
    .limit(1);
  let id = Array.isArray(existing) ? existing[0]?.id : null;
  if (!id) {
    const inserted = await api
      .from("backup_destinations")
      .insert({ name: `${provider} (test)`, provider, config: JSON.stringify(config ?? {}), enabled: false });
    if (inserted.error) throw new Error(inserted.error.message);
    const row = unwrap(inserted);
    id = row?.id ?? null;
  }
  if (!id) throw new Error("Could not resolve backup destination");

  const { data: res, error } = await api.request(
    `/admin/backup-destinations/${encodeURIComponent(id)}/test`,
    { method: "POST", body: JSON.stringify({ config }) },
  );
  if (error) throw new Error(error.message);
  return { ok: !!res?.ok, message: res?.message ?? (res?.ok ? "Test passed." : "Test failed.") };
}

export async function listBackupDestinations(input: any): Promise<any> {
  const { data, error } = await api.from("backup_destinations").select("*").order("name");
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return {
    destinations: rows.map((r: any) => ({ ...r, config: parseConfig(r.config) })),
  };
}

export async function createBackupDestination(input: any): Promise<any> {
  const data = input?.data ?? input;
  const row = {
    name: data?.name,
    provider: data?.provider,
    config: JSON.stringify(data?.config ?? {}),
    enabled: data?.enabled ?? true,
    is_default: data?.is_default ?? false,
  };
  const inserted = await api.from("backup_destinations").insert(row);
  if (inserted.error) throw new Error(inserted.error.message);
  const created = unwrap(inserted);
  return { destination: { ...created, config: parseConfig(created?.config) } };
}

export async function updateBackupDestination(input: any): Promise<any> {
  const data = input?.data ?? input;
  if (!data?.id) throw new Error("Destination id required");
  const updates: Record<string, any> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.provider !== undefined) updates.provider = data.provider;
  if (data.config !== undefined) updates.config = JSON.stringify(data.config);
  if (data.enabled !== undefined) updates.enabled = data.enabled;
  if (data.is_default !== undefined) updates.is_default = data.is_default;
  const { data: res, error } = await api
    .from("backup_destinations")
    .update(updates)
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { destination: unwrap(res) ?? { id: data.id, ...updates, config: parseConfig(updates.config) } };
}

export async function deleteBackupDestination(input: any): Promise<any> {
  const data = input?.data ?? input;
  if (!data?.id) throw new Error("Destination id required");
  const { error } = await api.from("backup_destinations").delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

function parseConfig(raw: any): Record<string, any> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return raw;
}