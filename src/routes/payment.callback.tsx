import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { verifyPayment } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/payment/callback")({
  head: () => ({ meta: [{ title: "Verifying payment — FAGE Ghana" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    reference: (s.reference as string) || (s.trxref as string) || "",
    provider: (s.provider as string) || "",
  }),
  component: PaymentCallback,
});

function PaymentCallback() {
  const { reference } = Route.useSearch();
  const navigate = useNavigate();
  const verify = useServerFn(verifyPayment);
  const [state, setState] = useState<"verifying" | "ok" | "pending" | "error">("verifying");
  const [message, setMessage] = useState("Confirming your payment with the gateway…");

  useEffect(() => {
    if (!reference) { setState("error"); setMessage("Missing payment reference."); return; }
    let cancelled = false;
    let attempts = 0;
    async function run() {
      try {
        const res = await verify({ data: { reference } });
        if (cancelled) return;
        if (res.status === "confirmed") {
          setState("ok");
          setMessage("Payment confirmed! Redirecting to your application…");
          // Re-issue cert if member already exists; route into apply form using tier from member_message
          const { data: sub } = await supabase.from("payment_submissions").select("member_message").eq("reference", reference).maybeSingle();
          const tier = sub?.member_message?.replace("tier:", "") || "standard";
          setTimeout(() => navigate({ to: "/apply/$tier", params: { tier } }), 1200);
        } else if (attempts < 8) {
          attempts++;
          setTimeout(run, 2000);
        } else {
          setState("pending");
          setMessage("We haven't received confirmation yet. You'll be notified as soon as the gateway confirms.");
        }
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setMessage(e?.message ?? "Verification failed.");
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [reference, verify, navigate]);

  return (
    <SiteLayout>
      <section className="py-24">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-10 text-center">
          {state === "verifying" && <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />}
          {state === "ok" && <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />}
          {(state === "pending" || state === "error") && <XCircle className="mx-auto mb-4 h-12 w-12 text-amber-500" />}
          <h1 className="text-xl font-bold">{state === "ok" ? "Payment confirmed" : state === "error" ? "Something went wrong" : state === "pending" ? "Awaiting confirmation" : "Verifying payment"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          {(state === "pending" || state === "error") && (
            <button onClick={() => navigate({ to: "/dashboard" })} className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Go to dashboard</button>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
