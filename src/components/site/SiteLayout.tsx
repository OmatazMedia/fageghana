import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
}) {
  return (
    <section className="relative h-[360px] w-full overflow-hidden md:h-[440px]">
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/70 via-brand-dark/50 to-brand-dark/80" />
      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col items-center justify-center px-4 text-center text-white">
        {eyebrow && (
          <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            {eyebrow}
          </span>
        )}
        <h1 className="text-4xl font-bold !text-white md:text-6xl">{title}</h1>
        {subtitle && <p className="mt-4 max-w-2xl text-base text-white/80 md:text-lg">{subtitle}</p>}
      </div>
    </section>
  );
}
