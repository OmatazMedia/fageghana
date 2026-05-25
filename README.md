# 🌿 FAGE Ghana — Federation of Associations of Ghanaian Exporters

> **Promoting non-traditional exports since 1992**

Official web platform for the Federation of Associations of Ghanaian Exporters (FAGE), Ghana's premier umbrella organisation for exporters and product associations. Built to empower Ghanaian exporters through digital tools, membership management, and global market connectivity.

---

## 🌍 Live Platform

The platform serves as the digital home for FAGE Ghana, providing:

- A public-facing website for exporters, partners, and international buyers
- A member portal for subscription management, certificates, and support
- An admin console for full operational management

---

## 📋 Table of Contents

- [About FAGE Ghana](#about-fage-ghana)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Pages & Routes](#pages--routes)
- [Member Portal](#member-portal)
- [Admin Console](#admin-console)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Support & Contact](#support--contact)
- [License](#license)
- [Development Team](#development-team)

---

## 🏛️ About FAGE Ghana

The **Federation of Associations of Ghanaian Exporters (FAGE)** is a not-for-profit umbrella organisation for exporters and product associations, registered under Ghana's Companies Code (Act 179, 1963), established in **1992**.

FAGE promotes the expansion and diversification of Ghanaian exports to foreign markets by:

- Assisting member firms in developing and marketing their products
- Improving the enabling environment for trade through government advocacy
- Providing capacity building, training, and market intelligence
- Facilitating trade fairs, missions, and international exhibitions

**Headquarters**: Number 22, Nii Tsatse Dzani Street, Adjiringanor, Accra, Ghana  
**Phone**: +233 (0) 53 517 0780 | +233 (0) 53 522 4555  
**Email**: info@fageghana.com  
**Website**: [www.fageghana.com](https://www.fageghana.com)

---

## ✨ Features

### Public Website

- 🏠 **Homepage** — Hero slider, services overview, impact statistics, partners marquee, product showcase, testimonials, news feed
- 👥 **Who We Are** — Organisation story, vision, mission, core values with parallax scroll animations
- 📦 **Products** — Masonry grid of 11 export product categories with click-to-expand descriptions
- 🤝 **Membership** — Tiered membership plans (Associate, Standard, Corporate) with application flow
- 📰 **News & Blog** — Published articles with cover images and excerpts
- 🎬 **Media** — Media centre for photos and videos
- 📅 **Activities** — Events and trade activities
- 🛠️ **Services** — Advocacy, matchmaking, trade support, research
- ✅ **Member Verification** — Public portal to verify any FAGE member by name, company or member ID
- 🔐 **Certificate Verification** — Verify certificate authenticity by unique code

### Member Portal (`/dashboard`)

- 📊 **Overview** — Membership status, expiry countdown, activity summary
- 💳 **Subscription** — View plan, submit payment (bank transfer or online), payment history
- 📜 **Certificate** — Download membership certificate as PNG or PDF
- 🔔 **Notifications** — Read announcements and alerts from FAGE
- 🎫 **Support** — Open and manage support tickets with admin replies
- 👤 **Profile** — Update company details, contact info, and membership tier

### Admin Console (`/admin`)

- 📈 **Dashboard** — KPI cards, quick actions, recent applications
- 👥 **Members** — View and manage all member profiles
- 📝 **Applications** — Review and approve membership applications
- 💰 **Payments** — Confirm or reject payment submissions
- 🏆 **Certificates** — Design templates, batch issue, manage issued certificates
- 📣 **Notifications** — Broadcast announcements to members
- 📰 **Content** — Manage news, products, activities, media
- ⚙️ **Configuration** — Payment gateways, subscription plans, form builder
- 📊 **Reports** — Export and financial reporting
- 💾 **Backup & Restore** — Database backup and restore tools

---

## 🛠️ Tech Stack

| Layer                     | Technology                                                     |
| ------------------------- | -------------------------------------------------------------- |
| **Framework**             | [TanStack Start](https://tanstack.com/start) (React + SSR)     |
| **Language**              | TypeScript                                                     |
| **Styling**               | Tailwind CSS v4                                                |
| **UI Components**         | shadcn/ui + Lucide Icons                                       |
| **Backend / Database**    | [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage) |
| **Routing**               | TanStack Router (file-based)                                   |
| **PDF Generation**        | jsPDF                                                          |
| **Certificate Rendering** | HTML5 Canvas                                                   |
| **Animations**            | CSS keyframes + IntersectionObserver                           |
| **Toast Notifications**   | Sonner                                                         |
| **Build Tool**            | Vite                                                           |
| **Package Manager**       | Bun                                                            |

---

## 📁 Project Structure

```
src/
├── assets/              # Static image assets
├── components/
│   ├── admin/           # AdminShell, FormField components
│   ├── auth/            # AuthProvider, AuthSplit layout
│   ├── forms/           # DynamicForm builder
│   ├── site/            # SiteHeader, SiteFooter, SiteLayout, Reveal, AnimBtn, AnimatedStat
│   └── ui/              # shadcn/ui component library
├── hooks/               # useInView, useCountUp, useMobile
├── integrations/
│   └── supabase/        # Supabase client, auth middleware, types
├── lib/                 # Utility functions, certificate renderer, payment functions
├── routes/              # All page routes (file-based routing)
│   ├── admin.*.tsx      # Admin console pages
│   ├── api/public/      # Webhook handlers (Paystack, Hubtel)
│   └── *.tsx            # Public & member pages
├── server/              # Server-side functions
├── styles.css           # Global styles, animations, Tailwind config
└── router.tsx           # Router configuration
```

---

## 🗺️ Pages & Routes

| Route               | Description                              | Access       |
| ------------------- | ---------------------------------------- | ------------ |
| `/`                 | Homepage                                 | Public       |
| `/about/who-we-are` | About FAGE, vision, mission, core values | Public       |
| `/membership`       | Membership plans and application         | Public       |
| `/products`         | Export product categories                | Public       |
| `/services`         | FAGE services overview                   | Public       |
| `/news`             | News and blog listing                    | Public       |
| `/news/:slug`       | Individual news article                  | Public       |
| `/activities`       | Events and activities                    | Public       |
| `/media`            | Media centre                             | Public       |
| `/verify`           | Public member & certificate verification | Public       |
| `/verify/:code`     | Certificate verification by code         | Public       |
| `/login`            | Member login                             | Public       |
| `/reset-password`   | Password reset flow                      | Public       |
| `/apply/:tier`      | Membership application form              | Public       |
| `/dashboard`        | Member portal                            | Members only |
| `/certificate/:id`  | Certificate view & download              | Members only |
| `/admin`            | Admin dashboard                          | Admins only  |
| `/admin/*`          | All admin sub-pages                      | Admins only  |

---

## 👤 Member Portal

Members access their portal at `/dashboard` after logging in at `/login`.

**Membership Tiers:**

- **Associate** — Entry level for SMEs entering international markets
- **Standard** — For established exporters needing deeper market insights
- **Corporate** — Premium tier for established export companies

**Payment Methods:**

- Manual bank transfer (with proof upload)
- Online payment via Paystack / Hubtel

---

## 🔧 Admin Console

Admins log in at `/admin/login`. The console provides full operational control including member management, payment confirmation, certificate issuance, content management, and system configuration.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Node.js](https://nodejs.org) >= 18
- A [Supabase](https://supabase.com) project

### Installation

```bash
# Clone the repository
git clone https://github.com/kodiriclimited-svg/fageghana.git
cd fageghana

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase credentials

# Start development server
bun dev
```

### Build for Production

```bash
bun run build
```

---

## 🔑 Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📞 Support & Contact

For technical support, feature requests, or business inquiries, please contact our development team.

**FAGE Ghana Office:**

- 📍 Number 22, Nii Tsatse Dzani Street, Adjiringanor, Accra
- 📱 +233 (0) 53 517 0780 | +233 (0) 53 522 4555
- 📧 info@fageghana.com

---

## 📄 License

This project is proprietary software developed for Kodiric Limited. All rights reserved.

---

## 👨‍💻 Development Team

**Author**: Omataz Media  
**Lead Developer**: Johnson Toluwani  
**Website**: [www.omatazmedia.com.ng](https://www.omatazmedia.com.ng)  
**Email**: [hello@omatazmedia.com.ng](mailto:hello@omatazmedia.com.ng)

**Contact Information**:

- 📱 Phone: +234 902 4599 289 | +234 703 7373 304
- 🌐 Website: www.omatazmedia.com.ng
- 📧 Email: hello@omatazmedia.com.ng

**Social Media**:

- 📘 Facebook: [@Omatazmedia](https://facebook.com/Omatazmedia)
- 📷 Instagram: [@Omatazmedia](https://instagram.com/Omatazmedia)
- 🐦 X (Twitter): [@Omatazmedia](https://x.com/Omatazmedia)
- 📺 YouTube: [@Omatazmedia](https://youtube.com/@Omatazmedia)

---

_Built with ❤️ by Omataz Media — Transforming digital experiences through innovative technology solutions._
