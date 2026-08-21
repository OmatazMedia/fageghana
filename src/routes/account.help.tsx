import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { supabase } from "@/integrations/api/client";
import { ROLE_HELP_DEFAULTS } from "@/lib/role-help";

export const Route = createFileRoute("/account/help")({
  head: () => ({
    meta: [
      { title: "Help Guide — FAGE Members" },
      {
        name: "description",
        content: "What you can do with your FAGE membership dashboard and where to find each feature.",
      },
    ],
  }),
  component: MemberHelpPage,
});

const MEMBER_TOPICS = [
  ["My profile & security", "Update your details, avatar, password and two-factor authentication under Account & Security."],
  ["Subscription & renewal", "See your expiry date, choose a plan and upload payment proof. Renewal reminders appear 3 months before expiry."],
  ["My certificate", "Download your membership certificate as PNG or PDF once it has been issued. The QR code links to your public verification page."],
  ["My directory listing", "Submit your business details for the member directory. Listings need admin approval and an active subscription."],
  ["Member directory", "Search other FAGE members by company name, email or phone. Available to signed-in active members."],
  ["Resources", "Guides and documents unlocked according to your membership tier."],
  ["Support", "Open a ticket from the Support page — available even when your subscription has expired."],
];

export function MemberHelpPage() {
  const [summary, setSummary] = useState(ROLE_HELP_DEFAULTS.user!.summary);
  const [details, setDetails] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("role_help" as any)
        .select("summary, details")
        .eq("role", "user")
        .maybeSingle();
      if (data) {
        if ((data as any).summary) setSummary((data as any).summary);
        if ((data as any).details) setDetails((data as any).details);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Help Guide</h2>
        <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        {details && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{details}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {MEMBER_TOPICS.map(([title, body]) => (
          <section key={title} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">{title}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
