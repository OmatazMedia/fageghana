import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Hubtel POSTs JSON to this URL after payment completes.
// SECURITY: Body is untrusted. We re-verify the payment server-side via the
// Hubtel transaction status API before confirming anything in our database.
export const Route = createFileRoute("/api/public/hubtel-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("bad json", { status: 400 });
        }
        const data = body?.Data ?? body?.data ?? body;
        const reference: string | undefined =
          data?.ClientReference ?? data?.clientReference;
        if (!reference) return new Response("missing reference", { status: 400 });

        const { data: sub } = await supabaseAdmin
          .from("payment_submissions")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();
        if (!sub) return new Response("not found", { status: 404 });
        if (sub.status === "confirmed") return new Response("ok", { status: 200 });

        // Re-verify with Hubtel rather than trusting the callback body
        const id = process.env.HUBTEL_CLIENT_ID;
        const secret = process.env.HUBTEL_CLIENT_SECRET;
        const merchant = process.env.HUBTEL_MERCHANT_ACCOUNT;
        if (!id || !secret || !merchant) {
          console.error("[hubtel-callback] missing Hubtel credentials");
          return new Response("not configured", { status: 503 });
        }

        const auth = "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
        const verifyRes = await fetch(
          `https://api-txnstatus.hubtel.com/transactions/${merchant}/status?clientReference=${encodeURIComponent(reference)}`,
          { headers: { Authorization: auth } },
        );
        const verifyJson: any = await verifyRes.json().catch(() => ({}));
        const verifiedStatus = verifyJson?.data?.status;
        const verifiedAmount = Number(verifyJson?.data?.amount ?? 0);

        if (
          verifyRes.ok &&
          verifiedStatus === "Paid" &&
          verifiedAmount + 0.01 >= Number(sub.amount)
        ) {
          await supabaseAdmin
            .from("payment_submissions")
            .update({
              status: "confirmed",
              confirmed_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});
