// @ts-nocheck
// Notify configured admins when a chatbot "Leave a message" arrives (anonymous).
import { api } from "@/integrations/api/client";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;

export async function notifyChatMessage(input: any): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const data = input?.data ?? input ?? {};
  const name = String(data.name ?? "").trim();
  const email = String(data.email ?? "").trim();
  const message = String(data.message ?? "").trim();
  if (!name || !email || !message) {
    return { ok: false, error: "Name, email and message are required" };
  }
  if (message.length > 5000) return { ok: false, error: "Message is too long" };

  try {
    const { data: res, error } = await api.request<any>("/public/chat/notify", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        phone: data.phone ?? null,
        message,
      }),
    });
    if (error) return { ok: false, error: error.message ?? "Could not send your message" };
    const body = unwrap(res) ?? {};
    return { ok: body.ok !== false, sent: typeof body.sent === "number" ? body.sent : 0 };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}