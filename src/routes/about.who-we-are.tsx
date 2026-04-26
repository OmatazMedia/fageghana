import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";

export const Route = createFileRoute("/about/who-we-are")({
  head: () => ({
    meta: [
      { title: "Who We Are — FAGE Ghana" },
      { name: "description", content: "FAGE is an umbrella organization of Ghanaian exporter and product associations established in 1992, dedicated to growing non-traditional exports." },
      { property: "og:title", content: "Who We Are — FAGE Ghana" },
      { property: "og:description", content: "Ghana's leading enabler of non-traditional exports since 1992." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop" },
    ],
  }),
  component: WhoWeArePage,
});

function WhoWeArePage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About FAGE"
        title="Who we are"
        imageUrl="https://images.unsplash.com/photo-1595841696677-6489ff3f8cd1?q=80&w=2070&auto=format&fit=crop"
      />

      <section className="py-20">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHO WE ARE</p>
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">Ghana's leading enabler of Non-Traditional Exports.</h2>
          <p className="text-muted-foreground leading-relaxed">
            The Federation of Associations of Ghanaian Exporters (FAGE) is an umbrella organization of exporter and product associations, established in 1992. We aim to be Ghana's leading enabler of Non-Traditional Exports, empowering members for international success through global best practices, advocacy, market development, and facilitated funding. FAGE is dedicated to export growth and innovation.
          </p>
          <Link to="/membership" className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition">
            Contact us <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE DO</p>
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">Our Impact By Numbers</h2>
          <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
            See how we are connecting locally manufactured produce with international buyers through measurable success.
          </p>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { num: "1992", label: "Operational Since" },
              { num: "2,800+", label: "Members Added" },
              { num: "$4.8B", label: "Export Value Enabled" },
            ].map((n) => (
              <div key={n.label} className="rounded-2xl bg-card p-10 shadow-sm">
                <div className="text-5xl font-bold text-primary">{n.num}</div>
                <div className="mt-3 text-sm uppercase tracking-wider text-muted-foreground">{n.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 lg:grid-cols-2">
          <img
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/26633402-aa43-4311-9a4d-5addc151e624/image-1769557939739.png"
            alt="Become a FAGE Member"
            className="rounded-2xl shadow-lg"
          />
          <div>
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">JOIN US</p>
            <h2 className="mb-5 text-3xl font-bold md:text-4xl">Become a FAGE Member</h2>
            <p className="mb-7 text-muted-foreground leading-relaxed">
              Ready to start working together? Join Ghana's premier network of exporters and gain access to the resources, advocacy, and markets you need to succeed globally.
            </p>
            <Link to="/membership" className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:scale-105 transition">
              Learn More <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
