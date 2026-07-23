import { createFileRoute } from "@tanstack/react-router";
import { FAGE_SYSTEM_PROMPT } from "@/lib/chatbot-knowledge";

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatBody = {
  messages?: ChatMessage[];
  contact?: { name?: string; email?: string; phone?: string } | null;
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
        if (messages.length === 0) return new Response("messages required", { status: 400 });

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: FAGE_SYSTEM_PROMPT },
              ...messages.map((m) => ({ role: m.role, content: String(m.content ?? "") })),
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (res.status === 429) return Response.json({ error: "rate_limited" }, { status: 429 });
          if (res.status === 402) return Response.json({ error: "credits" }, { status: 402 });
          return new Response(text || "AI gateway error", { status: 502 });
        }

        const data = (await res.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const reply = data.choices?.[0]?.message?.content?.trim() ?? "";
        const escalate = reply.startsWith("ESCALATE:");
        let ticketId: string | null = null;

        if (escalate) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const summary = reply.replace(/^ESCALATE:\s*/i, "").trim();
            const transcript = messages
              .map((m) => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
              .join("\n");
            const contact = body.contact ?? null;
            const { data: t } = await supabaseAdmin
              .from("support_tickets")
              .insert({
                subject: `Chatbot escalation: ${summary.slice(0, 120) || "Unresolved question"}`,
                status: "open",
                priority: "normal",
                source: "chat_widget",
                contact_name: contact?.name ?? null,
                contact_email: contact?.email ?? null,
                contact_phone: contact?.phone ?? null,
                message: `${summary}\n\n---\nTranscript:\n${transcript}`,
              } as any)
              .select("id")
              .single();
            ticketId = (t as any)?.id ?? null;
          } catch {
            /* swallow — still return a useful reply */
          }
        }

        return Response.json({
          reply: escalate
            ? "I'll route your question to the FAGE team — someone will follow up shortly. In the meantime, feel free to ask about membership, services, or events."
            : reply,
          escalated: escalate,
          ticketId,
        });
      },
    },
  },
});
