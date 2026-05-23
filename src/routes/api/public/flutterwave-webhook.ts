import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finalizePaymentConfirmation } from "@/lib/membership.server";

export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("verif-hash") || "";
        const event = (() => { try { return JSON.parse(raw); } catch { return null; } })();
        const reference = (event?.data?.tx_ref ?? event?.txRef) as string | undefined;

        // Find gateway via the submission to read its webhook_secret
        let webhookSecret = "";
        if (reference) {
          const { data: sub } = await supabaseAdmin.from("payment_submissions").select("gateway_id").eq("reference", reference).maybeSingle();
          if (sub?.gateway_id) {
            const { data: gw } = await supabaseAdmin.from("payment_gateways").select("config").eq("id", sub.gateway_id).maybeSingle();
            webhookSecret = ((gw?.config as any)?.webhook_secret as string | undefined) ?? "";
          }
        }
        if (!webhookSecret) return new Response("Not configured", { status: 500 });
        if (signature !== webhookSecret) return new Response("Invalid signature", { status: 401 });

        const status = event?.data?.status;
        if ((event?.event === "charge.completed" || status) && status === "successful" && reference) {
          const amount = Number(event?.data?.amount ?? 0);
          const { data: sub } = await supabaseAdmin
            .from("payment_submissions").select("*").eq("reference", reference).maybeSingle();
          if (sub && sub.status !== "confirmed" && amount >= Number(sub.amount)) {
            await supabaseAdmin.from("payment_submissions").update({
              status: "confirmed", confirmed_at: new Date().toISOString(),
            }).eq("id", sub.id);
            try { await finalizePaymentConfirmation(sub.id); } catch (e: any) { console.error("finalize failed:", e?.message ?? e); }
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
