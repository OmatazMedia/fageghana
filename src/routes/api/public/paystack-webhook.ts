import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finalizePaymentConfirmation } from "@/lib/membership.server";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Find the secret key — prefer the gateway row's saved key, fall back to env
        const raw = await request.text();
        const signature = request.headers.get("x-paystack-signature") || "";
        const event = (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })();
        const reference = event?.data?.reference as string | undefined;

        let secret = process.env.PAYSTACK_SECRET_KEY || "";
        if (reference) {
          const { data: sub } = await supabaseAdmin
            .from("payment_submissions")
            .select("gateway_id")
            .eq("reference", reference)
            .maybeSingle();
          if (sub?.gateway_id) {
            const { data: gw } = await supabaseAdmin
              .from("payment_gateways")
              .select("config")
              .eq("id", sub.gateway_id)
              .maybeSingle();
            const k = (gw?.config as any)?.secret_key as string | undefined;
            if (k) secret = k;
          }
        }
        if (!secret) return new Response("Not configured", { status: 500 });

        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        try {
          if (!signature || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        if (event?.event === "charge.success" && reference) {
          const amount = Number(event?.data?.amount ?? 0);
          const { data: sub } = await supabaseAdmin
            .from("payment_submissions")
            .select("*")
            .eq("reference", reference)
            .maybeSingle();
          if (sub && sub.status !== "confirmed" && amount >= Math.round(Number(sub.amount) * 100)) {
            await supabaseAdmin
              .from("payment_submissions")
              .update({
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
              })
              .eq("id", sub.id);
            try {
              await finalizePaymentConfirmation(sub.id);
            } catch (e: any) {
              console.error("finalize failed:", e?.message ?? e);
            }
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
