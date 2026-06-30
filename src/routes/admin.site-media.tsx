import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { HeroSlidesManager } from "@/components/admin/HeroSlidesManager";
import { PartnerLogosManager } from "@/components/admin/PartnerLogosManager";

export const Route = createFileRoute("/admin/site-media")({
  head: () => ({ meta: [{ title: "Homepage Media — FAGE Admin" }] }),
  component: SiteMediaAdmin,
});

function SiteMediaAdmin() {
  return (
    <AdminShell
      title="Homepage Media"
      description="Manage the homepage hero carousel slides and the Our Partners logo strip. Changes are live immediately."
    >
      <div className="space-y-10">
        <section className="rounded-2xl bg-card p-6 shadow-sm">
          <HeroSlidesManager />
        </section>
        <section className="rounded-2xl bg-card p-6 shadow-sm">
          <PartnerLogosManager />
        </section>
      </div>
    </AdminShell>
  );
}
