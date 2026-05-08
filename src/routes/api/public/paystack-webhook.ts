import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const signature = request.headers.get("x-paystack-signature") || "";
        const raw = await request.text();
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        try {
          if (!signature || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(raw);
        if (event?.event === "charge.success") {
          const reference = event?.data?.reference as string | undefined;
          const amount = Number(event?.data?.amount ?? 0);
          if (reference) {
            const { data: sub } = await supabaseAdmin
              .from("payment_submissions").select("*").eq("reference", reference).maybeSingle();
            if (sub && sub.status !== "confirmed" && amount >= Math.round(Number(sub.amount) * 100)) {
              await supabaseAdmin.from("payment_submissions").update({
                status: "confirmed", confirmed_at: new Date().toISOString(),
              }).eq("id", sub.id);
            }
          }
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
