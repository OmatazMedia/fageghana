import { supabase } from "@/integrations/api/client";

export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("content")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from("content").getPublicUrl(path);
  return data.publicUrl;
}
