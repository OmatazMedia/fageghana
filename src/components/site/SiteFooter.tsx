import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                F
              </div>
              <span className="font-bold text-lg">FAGE</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              The Federation of Associations of Ghanaian Exporters — promoting non-traditional exports since 1992.
            </p>
            <div className="mt-5 flex gap-3">
              {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a key={i} href="#" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-primary transition">
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
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-primary" /> Accra, Ghana</li>
              <li className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> +233 (0) 53 517 0780</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> info@fageghana.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Federation of Associations of Ghanaian Exporters. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
