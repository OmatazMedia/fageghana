import { createContext, useContext, useState, type ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { ChatWidget } from "./ChatWidget";
import { BackToTop } from "./BackToTop";
import { SearchOverlay } from "./SearchOverlay";

const SearchCtx = createContext<{ open: () => void }>({ open: () => {} });
export const useSiteSearch = () => useContext(SearchCtx);

export function SiteLayout({ children }: { children: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [raised, setRaised] = useState(false);

  return (
    <SearchCtx.Provider value={{ open: () => setSearchOpen(true) }}>
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ChatWidget raised={raised} />
      <BackToTop onVisibilityChange={setRaised} />
    </SearchCtx.Provider>
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
    <section className="relative w-full overflow-hidden min-h-[clamp(320px,50vh,600px)]">
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-brand-dark/70 via-brand-dark/50 to-brand-dark/80" />
      <div className="relative z-10 mx-auto flex min-h-[clamp(320px,50vh,600px)] max-w-7xl flex-col items-center justify-center px-6 py-20 text-center text-white">
        {eyebrow && (
          <span className="mb-4 inline-block rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            {eyebrow}
          </span>
        )}
        <h1 className="font-bold !text-white" style={{ fontSize: "clamp(1.75rem, 4vw, 4rem)" }}>
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-4 max-w-2xl text-white/80"
            style={{ fontSize: "clamp(0.875rem, 1.5vw, 1.125rem)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
