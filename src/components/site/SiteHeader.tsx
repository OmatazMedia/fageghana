import { Link } from "@tanstack/react-router";
import { Mail, Phone, ShieldCheck, ArrowRight, Menu, X, ChevronDown, Search, User } from "lucide-react";
import { useState, useEffect } from "react";

const aboutItems = [
  { to: "/about/who-we-are", label: "Who We Are" },
  { to: "/products", label: "Products" },
  { to: "/services", label: "Services" },
] as const;

const navItems = [
  { to: "/news", label: "News & Blog" },
  { to: "/activities", label: "Activities" },
  { to: "/media", label: "Media" },
  { to: "/membership", label: "Membership" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [topBarVisible, setTopBarVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      setTopBarVisible(window.scrollY < 40);
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (el.scrollTop / total) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      {/* Top utility bar — hides while scrolled, shows at top */}
      <div
        className="bg-primary text-primary-foreground text-xs overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: topBarVisible ? "40px" : "0px", opacity: topBarVisible ? 1 : 0 }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Promoting non-traditional exports</span>
            <Link to="/membership" className="hidden sm:inline underline-offset-4 hover:underline">Join us now →</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/verify" className="flex items-center gap-1 hover:underline">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verify Member</span>
            </Link>
            <a href="mailto:info@fageghana.com" className="hidden md:flex items-center gap-1 hover:underline">
              <Mail className="h-3.5 w-3.5" />
              <span>info@fageghana.com</span>
            </a>
            <a href="tel:+233535170780" className="hidden md:flex items-center gap-1 hover:underline">
              <Phone className="h-3.5 w-3.5" />
              <span>+233 (0) 53 517 0780</span>
            </a>
            <a href="tel:+233535224555" className="hidden md:flex items-center gap-1 hover:underline">
              <Phone className="h-3.5 w-3.5" />
              <span>+233 (0) 53 522 4555</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/images/logos/fage-logo-main.webp"
            alt="FAGE Logo"
            className="h-10 w-auto object-contain"
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {/* About dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setAboutOpen(true)}
            onMouseLeave={() => setAboutOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              onClick={() => setAboutOpen((v) => !v)}
            >
              About <ChevronDown className={`h-4 w-4 transition-transform ${aboutOpen ? "rotate-180" : ""}`} />
            </button>
            {aboutOpen && (
              <div className="absolute left-1/2 top-full z-50 w-48 -translate-x-1/2 pt-3">
                <div className="rounded-xl border border-border bg-card p-2 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                  {aboutItems.map((it) => (
                    <Link
                      key={it.to}
                      to={it.to}
                      onClick={() => setAboutOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-primary"
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary font-semibold" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Search"
            className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-accent hover:text-primary"
          >
            <Search className="h-4.5 w-4.5" />
          </button>
          <Link
            to="/login"
            aria-label="Member login"
            className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-accent hover:text-primary"
          >
            <User className="h-4.5 w-4.5" />
          </Link>
          <Link
            to="/membership"
            className="lets-talk-btn hidden md:inline-flex"
          >
            {/* Circle starts LEFT, slides to RIGHT on hover */}
            <span className="lets-talk-circle">
              <ArrowRight className="h-4 w-4" />
            </span>
            {/* Text sits behind the circle */}
            <span className="lets-talk-text">Let's Talk</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-3">
            <div className="py-3 border-b border-border">
              <div className="text-sm font-semibold text-foreground mb-2">About</div>
              <div className="flex flex-col gap-1 pl-3">
                {aboutItems.map((it) => (
                  <Link key={it.to} to={it.to} onClick={() => setOpen(false)} className="py-1.5 text-sm text-foreground/80">
                    {it.label}
                  </Link>
                ))}
              </div>
            </div>
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-medium text-foreground border-b border-border last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/membership"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Let's Talk <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      )}
      {/* Page progress bar */}
      <div className="absolute bottom-0 left-0 h-[3px] w-full bg-transparent">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </header>
  );
}
