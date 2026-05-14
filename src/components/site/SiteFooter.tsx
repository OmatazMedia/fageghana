import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Facebook, Linkedin, Instagram } from "lucide-react";

const socials = [
  { Icon: Linkedin,  href: "https://www.linkedin.com/company/federation-of-association-of-ghanaian-exporters-fage/", label: "LinkedIn" },
  { Icon: Instagram, href: "https://www.instagram.com/fageghana/",  label: "Instagram" },
  { Icon: Facebook,  href: "https://web.facebook.com/FAGEGH",        label: "Facebook" },
];

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/images/logos/fage-logo-white.webp"
                alt="FAGE Logo"
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              The Federation of Associations of Ghanaian Exporters — promoting non-traditional exports since 1992.
            </p>
            <div className="mt-5 flex gap-3">
              {socials.map(({ Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-primary transition">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">Explore</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/about/who-we-are" className="hover:text-primary">About Us</Link></li>
              <li><Link to="/services" className="hover:text-primary">Services</Link></li>
              <li><Link to="/products" className="hover:text-primary">Products</Link></li>
              <li><Link to="/activities" className="hover:text-primary">Activities</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">Resources</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link to="/news" className="hover:text-primary">News</Link></li>
              <li><Link to="/media" className="hover:text-primary">Media Center</Link></li>
              <li><Link to="/membership" className="hover:text-primary">Membership</Link></li>
              <li><Link to="/verify" className="hover:text-primary">Verify a Member</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>Number 22, Nii Tsatse Dzani Street,<br />Adjiringanor, Accra</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  <a href="tel:+233535170780" className="hover:text-primary block">+233 (0) 53 517 0780</a>
                  <a href="tel:+233535224555" className="hover:text-primary block">+233 (0) 53 522 4555</a>
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-primary" />
                <a href="mailto:info@fageghana.com" className="hover:text-primary">info@fageghana.com</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 flex flex-col items-center gap-1 text-center text-xs text-white/50">
          <span>© {new Date().getFullYear()} Federation of Associations of Ghanaian Exporters. All rights reserved.</span>
          <span>Developed by{" "}
            <a href="https://omatazmedia.com.ng" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-primary transition-colors">
              Omataz Media
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
