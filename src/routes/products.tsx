import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Leaf, Package, Award, Sprout, Check } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/products")({
  head: () => ({
    meta: [
      { title: "Our Products — FAGE Ghana" },
      { name: "description", content: "Quality Ghanaian products trusted by international buyers worldwide — fresh produce, processed foods, and more." },
      { property: "og:title", content: "Our Products — FAGE Ghana" },
      { property: "og:description", content: "Quality Ghanaian products trusted by international buyers worldwide." },
      { property: "og:image", content: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80" },
    ],
  }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  image_url: string | null;
  features: string[];
};

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void supabase
      .from("products")
      .select("id,name,category,description,image_url,features")
      .eq("published", true)
      .order("display_order")
      .then(({ data }) => {
        if (data) setProducts(data as Product[]);
      });
  }, []);

  const categories = [
    { icon: Leaf, title: "Fresh Produce", text: "Farm-fresh fruits and vegetables harvested at peak quality and delivered to international markets." },
    { icon: Package, title: "Processed Foods", text: "Value-added products including dried fruits, juices, and packaged goods meeting global standards." },
    { icon: Award, title: "Export Quality", text: "All products meet international quality certifications and food safety standards for global distribution." },
    { icon: Sprout, title: "Sustainable Growth", text: "Products sourced from sustainable farming practices supporting local communities and the environment." },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Our Products"
        title="Our Products"
        subtitle="Quality Ghanaian products trusted by international buyers worldwide"
        imageUrl="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&q=80"
      />

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">WHAT WE OFFER</p>
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Products You Can Trust</h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              FAGE members produce and export a diverse range of high-quality agricultural products. From fresh produce to processed goods, every product meets international standards and represents the best of Ghanaian agriculture.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => (
              <div key={c.title} className="rounded-2xl border border-border bg-card p-6 transition hover:shadow-md">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
                  <c.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-semibold tracking-widest text-primary">FEATURED PRODUCTS</p>
            <h2 className="text-3xl font-bold md:text-4xl">Our Main Exports</h2>
          </div>
          <div className="space-y-12">
            {products.map((p, i) => (
              <div key={p.id} className={`grid grid-cols-1 items-center gap-10 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <div className="overflow-hidden rounded-2xl shadow-lg aspect-[4/3] bg-muted">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                </div>
                <div>
                  <span className="text-5xl font-bold text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 text-3xl font-bold">{p.name}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{p.description}</p>
                  {p.features.length > 0 && (
                    <ul className="mt-5 space-y-2">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
