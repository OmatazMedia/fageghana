import { Link } from "@tanstack/react-router";
import { Mail, Phone, ShieldCheck, ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/about/who-we-are", label: "About" },
  { to: "/products", label: "Products" },
  { to: "/services", label: "Services" },
  { to: "/news", label: "News" },
  { to: "/activities", label: "Activities" },
  { to: "/media", label: "Media" },
  { to: "/membership", label: "Membership" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      {/* Top utility bar */}
      <div className="bg-primary text-primary-foreground text-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Promoting non-traditional exports</span>
            <Link to="/membership" className="hidden sm:inline underline-offset-4 hover:underline">
              Join us now →
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/admin/login" className="flex items-center gap-1 hover:underline">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin Login
            </Link>
            <a href="mailto:info@fageghana.com" className="hidden md:flex items-center gap-1 hover:underline">
              <Mail className="h-3.5 w-3.5" /> info@fageghana.com
            </a>
            <a href="tel:+2330535170780" className="hidden md:flex items-center gap-1 hover:underline">
              <Phone className="h-3.5 w-3.5" /> +233 (0) 53 517 0780
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
            F
          </div>
          <div className="leading-tight">
            <div className="font-bold text-lg text-brand-dark">FAGE</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Federation of Associations of Ghanaian Exporters
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
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

        <div className="flex items-center gap-2">
          <Link
            to="/membership"
            className="hidden md:inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105"
          >
            Let's Talk <ArrowRight className="h-4 w-4" />
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
    </header>
  );
}
