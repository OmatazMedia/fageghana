import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

export function AuthSplit({
  imageUrl, eyebrow, title, subtitle, bullets, children, footer,
}: {
  imageUrl: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  bullets: string[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <img src={imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-primary/95" />
        <div className="relative">
          <Link to="/" className="text-sm opacity-80 hover:opacity-100">← Back to FAGE Ghana</Link>
          <p className="mt-10 text-xs font-semibold uppercase tracking-widest opacity-90">{eyebrow}</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">{title}</h2>
          <p className="mt-4 max-w-md text-base opacity-90">{subtitle}</p>
        </div>
        <ul className="relative z-10 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-foreground/20"><Check className="h-3 w-3" /></span>
              {b}
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary lg:hidden">← Back to site</Link>
          {children}
          {footer}
        </div>
      </main>
    </div>
  );
}
