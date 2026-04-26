## FAGE Ghana — Full Site Clone with Admin CMS

I'll rebuild the FAGE Ghana site in Lovable, matching the original look and content, and add a Lovable Cloud–powered admin so you can manage News, Products, Activities, Media, and Membership applications without touching code.

---

### 1. Public website (8 pages, cloned 1:1)

A shared header/footer wraps every page. The header has the green top bar (contact info + Admin Login), logo, primary nav (About, Products, Services, News, Activities, Media, Membership) and a green "Let's Talk" CTA — same as the source site.

**Pages**
- **Home (`/`)** — Hero carousel ("Federation of Associations of Ghanaian Exporters" with the same background images), the four service cards (Advocacy, Matchmaking, Trade Support, Research), "What We Do / Services" section, and the rest of the homepage sections from the original.
- **About → Who We Are (`/about/who-we-are`)** — Mission, vision, history, and team content from the source.
- **Products (`/products`)** — Product grid pulled from the database (managed in admin).
- **Services (`/services`)** — Static services breakdown matching the original.
- **News (`/news`)** — News article listing with detail pages (`/news/$slug`), pulled from the database.
- **Activities (`/activities`)** — Activities/events listing pulled from the database.
- **Media (`/media`)** — Photo & video gallery pulled from the database.
- **Membership (`/membership`)** — Info about membership tiers/benefits + an application form. Submissions are saved to the database for admin review.

All text and images will be reused from the original site (referencing the existing image URLs so it looks identical). Each route gets its own SEO meta (title, description, og tags).

**Design system**: green primary (`#16a34a`-style) matching FAGE branding, white background, dark navy text — same vibe as the source.

---

### 2. Admin CMS (`/admin`)

- **Admin Login (`/admin/login`)** — Email + password authentication via Lovable Cloud.
- **Admin Dashboard (`/admin`)** — Sidebar with sections for each content type. Only users with the `admin` role can access (enforced via a separate `user_roles` table for security).

**Manageable content**
- **News** — create / edit / delete articles (title, slug, cover image, body, publish date, published toggle).
- **Products** — manage product cards (name, image, description, category).
- **Activities** — manage activities/events (title, date, location, image, description).
- **Media** — upload photos and add video links to the gallery.
- **Membership applications** — view submissions, mark as reviewed/approved/rejected.

Public pages read from these tables; admin pages write to them. Role checks happen server-side so admin access cannot be bypassed from the browser.

---

### 3. Backend (Lovable Cloud)

Tables: `news`, `products`, `activities`, `media`, `membership_applications`, `user_roles` (with `app_role` enum). RLS policies:
- Public read for published News/Products/Activities/Media.
- Anyone can submit a membership application; only admins can read them.
- Only admins can insert/update/delete content tables.

Image uploads (for news covers, products, activities, media) go to a Lovable Cloud storage bucket.

---

### 4. Build approach

1. Set up Lovable Cloud, auth, storage bucket, all tables + RLS, and the `user_roles` admin role system.
2. Build the shared header/footer layout and design tokens.
3. Build all 8 public pages with content/images cloned from the source (static pages first, then wire News/Products/Activities/Media/Membership to the database).
4. Build the admin login + dashboard with CRUD for each content type and the membership submissions inbox.
5. Seed initial content (News, Products, Activities, Media) by importing what's currently on the live source site so the rebuilt site isn't empty on day one.

After implementation, you'll create your admin user via the signup flow and I'll grant it the admin role so you can log in at `/admin`.