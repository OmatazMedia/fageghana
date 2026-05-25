import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Hubtel POSTs JSON to this URL after payment completes.
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
        const reference: string | undefined = data?.ClientReference ?? data?.clientReference;
        const status: string | undefined = data?.Status ?? data?.status;
        const amount = Number(data?.Amount ?? data?.amount ?? 0);
        if (!reference) return new Response("missing reference", { status: 400 });

        const { data: sub } = await supabaseAdmin
          .from("payment_submissions")
          .select("*")
          .eq("reference", reference)
          .maybeSingle();
        if (!sub) return new Response("not found", { status: 404 });

        if (
          (status === "Paid" || status === "Success") &&
          sub.status !== "confirmed" &&
          amount + 0.01 >= Number(sub.amount)
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
