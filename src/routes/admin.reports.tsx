import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Award, MessageCircle } from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports & Analytics — Admin" }] }),
  component: Reports,
});

const sections = [
  { icon: TrendingUp, title: "Membership growth", desc: "New members per month, retention." },
  { icon: BarChart3, title: "Revenue by month", desc: "Subscription income, by tier and gateway." },
  { icon: Award, title: "Certificates issued", desc: "Volume issued, expiring soon, renewal funnel." },
  { icon: MessageCircle, title: "Support performance", desc: "Avg response time, resolution rate, open backlog." },
];

function Reports() {
  return (
    <AdminShell title="Reports & Analytics" description="Insights across membership, revenue, certificates and support.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sections.map(s => (
          <div key={s.title} className="rounded-2xl border border-dashed border-border bg-card p-6">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="font-bold">{s.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            <div className="mt-4 flex h-32 items-center justify-center rounded-lg bg-muted/40 text-xs text-muted-foreground">
              Coming soon
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
