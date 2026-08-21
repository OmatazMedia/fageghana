# FAGE Ghana — Supabase → Laravel PHP Migration Plan

> **Date:** August 18, 2026  
> **Scope:** Full backend replacement — React frontend stays as-is, exported as static SPA for cPanel  
> **Stack Change:** Supabase (PostgreSQL + Edge Functions + Auth + RLS) → Laravel PHP (MySQL/SQLite + Sanctum Auth + REST API)

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [New Architecture](#2-new-architecture)
3. [Database Mapping (40+ Tables)](#3-database-mapping)
4. [Security Model Translation](#4-security-model-translation)
5. [Phase Breakdown](#5-phase-breakdown)
6. [Guided Installation Wizard](#6-guided-installation-wizard)
7. [Backup System](#7-backup-system)
8. [Frontend Adaptation Strategy](#8-frontend-adaptation-strategy)
9. [Deployment: cPanel + Laravel](#9-deployment-cpanel--laravel)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Current Architecture Summary

### Frontend
- **Framework:** React 19 + TanStack Start/Router + Vite
- **UI:** Tailwind CSS 4 + Radix UI + shadcn/ui components
- **State:** TanStack React Query
- **Auth:** Supabase Auth (client-side session management)
- **Server Functions:** TanStack Start server functions (call Supabase with user JWT)
- **Deploy target:** Currently Cloudflare → will become cPanel static hosting

### Backend (Supabase)
- **Database:** PostgreSQL with 52 migrations, 40+ tables, 10+ enums
- **Auth:** Supabase Auth (JWT-based, social providers possible)
- **RLS:** Row-Level Security policies enforce permissions at DB level
- **Edge Functions:** 2 Deno functions (trade opportunities, email preferences)
- **Server Functions:** 20+ TanStack Start server functions calling Supabase Admin client
- **Storage:** Supabase Storage (content images bucket)
- **Webhooks:** Paystack, Flutterwave, Hubtel payment callbacks

### Key Tables (40+)

| Category | Tables |
|----------|--------|
| **Auth & Roles** | `user_roles`, `user_sessions`, `login_attempts`, `ip_bans`, `user_email_mfa`, `email_otp_codes`, `role_permissions`, `role_help` |
| **Members** | `member_profiles`, `member_documents`, `member_email_preferences`, `member_id_counters`, `membership_applications`, `pending_applications`, `membership_resources` |
| **Payments** | `payment_gateways`, `payment_submissions`, `subscription_plans` |
| **Content** | `news`, `products`, `activities`, `media`, `site_hero_slides`, `site_partner_logos` |
| **Directory** | `directory_entries`, `directory_custom_field_defs` |
| **Support** | `support_tickets`, `ticket_messages`, `contact_messages` |
| **Certificates** | `certificates`, `certificate_templates` |
| **Email** | `email_settings`, `email_templates`, `email_log` |
| **Chatbot** | `chatbot_knowledge`, `chatbot_feedback` |
| **Trade** | `trade_opportunities`, `trade_opportunity_interests` |
| **Security** | `security_settings`, `activity_log`, `notifications`, `notification_reads` |
| **Backups** | `backup_runs`, `backup_destinations`, `backup_schedules`, `backup_run_uploads` |
| **Readiness** | `readiness_checklist_items`, `member_readiness_responses` |
| **Forms** | `application_forms` |

### Database Enums
```
app_role:          admin, editor, user, staff, moderator, finance, ceo, developer, coordinator, superadmin
application_status: new, reviewing, approved, rejected
membership_tier:   associate, corporate, standard
payment_status:    pending, confirmed, rejected
media_type:        photo, video
readiness_status:  not_started, in_progress, complete
ticket_status:     open, pending, resolved, closed
directory_entry_type: association, corporate
```

### Database Functions (RPC)
- `has_role()` — Role checking
- `generate_member_id()` / `generate_structured_member_id()` — Member ID generation
- `get_readiness_score()` — Readiness calculation
- `verify_certificate()` / `verify_certificate_with_template()` — Certificate verification
- `submit_my_directory_entry()` — Directory submission
- `admin_review_directory_entry()` — Admin directory review
- `revoke_user_session()` / `revoke_my_other_sessions()` — Session management
- `purge_old_login_attempts()` — Security cleanup
- `increment_activity_views()` — View counting
- `public_search_members()` — Member search
- `user_meets_min_tier()` — Tier checking
- `get_pending_application()` — Application lookup
- `console_account_for_email()` — Email lookup
- `admin_*` functions — Admin utilities

### Edge Functions
1. **fetch-trade-opportunities** — RSS feed parser (ITC Trade Map), scheduled via pg_cron
2. **manage-email-preferences** — Upserts email prefs, sends confirmation emails via Resend

### Payment Integrations
- **Paystack** (inline + webhook verification)
- **Flutterwave** (inline + webhook verification)
- **Hubtel** (checkout redirect + callback)

---

## 2. New Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT TARGET                     │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │   cPanel      │    │  cPanel / VPS                 │   │
│  │  (Static)     │    │  (PHP 8.2+)                   │   │
│  │               │    │                               │   │
│  │  React SPA    │───▶│  Laravel 11 REST API          │   │
│  │  (Vite build) │    │  ├── Sanctum (JWT Auth)       │   │
│  │               │    │  ├── Eloquent ORM              │   │
│  │  dist/ folder │    │  ├── MySQL 8 / SQLite (dev)   │   │
│  │               │    │  ├── Queue (email, backups)    │   │
│  │  public/      │    │  └── Storage (file uploads)    │   │
│  └──────────────┘    └──────────────────────────────┘   │
│         │                        │                       │
│         │     HTTPS / CORS       │                       │
│         └────────────────────────┘                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Laravel API Routes                                │   │
│  │                                                     │   │
│  │  /api/v1/auth/*          Authentication            │   │
│  │  /api/v1/admin/*         Admin panel APIs           │   │
│  │  /api/v1/member/*        Member dashboard APIs      │   │
│  │  /api/v1/public/*        Public content APIs         │   │
│  │  /api/v1/webhooks/*      Payment webhooks            │   │
│  │  /setup                  Installation wizard          │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Frontend Adaptation
The React frontend will be modified minimally:
- Replace `supabase` client with a custom `apiClient` (fetch wrapper with JWT)
- Replace `supabase.auth.*` calls with `api/auth/*` endpoint calls
- Replace `supabase.from('table').select()` calls with `api/v1/*` endpoint calls
- TanStack Start server functions become direct `fetch()` calls to Laravel API
- **No UI changes** — only the data-fetching layer changes

### Security Translation
| Supabase Concept | Laravel Equivalent |
|---|---|
| Supabase Auth (JWT) | Laravel Sanctum (SPA token auth) |
| Row-Level Security (RLS) | Laravel Policy classes + Middleware |
| `auth.uid()` in RLS | `$request->user()` in controllers |
| `has_role()` DB function | `Role` model with `hasRole()` method |
| Service Role key (admin) | Admin middleware + admin guard |
| Storage bucket policies | Laravel filesystem + policy authorization |

---

## 3. Database Mapping

### MySQL Compatibility Notes
| PostgreSQL | MySQL Equivalent |
|---|---|
| `UUID` primary keys | `CHAR(36)` or `BINARY(16)` with UUID generation |
| `TEXT[]` arrays | `JSON` column or pivot table |
| `INET` type | `VARCHAR(45)` |
| `JSONB` | `JSON` |
| `TIMESTAMPTZ` | `DATETIME` + app-level timezone handling |
| `gen_random_uuid()` | Laravel's `Str::uuid()` or DB-level UUID |
| `ENUM` types | MySQL `ENUM` or string columns (Laravel enum casts) |
| `SECURITY DEFINER` functions | Laravel Policy/Middleware logic |
| `pg_cron` | Laravel Task Scheduling (`Kernel::schedule()`) |
| RLS policies | Laravel middleware + Eloquent scopes |

### Migration Strategy
Laravel will use a **single initial migration** that recreates the full schema, preserving:
- All table structures and relationships
- All indexes and constraints
- Default values and timestamps
- Proper foreign key relationships

---

## 4. Security Model Translation

### From Supabase RLS → Laravel Policies

```php
// Example: Admin-only news management (replaces RLS)
// Supabase: CREATE POLICY "Admins manage news" ... USING (has_role(auth.uid(), 'admin'))

// Laravel:
class NewsPolicy extends Policy {
    public function viewAny(User $user) { return true; } // published only
    public function view(User $user, News $news) { 
        return $news->published || $user->hasRole(['admin', 'editor']);
    }
    public function create(User $user) { return $user->hasRole(['admin', 'editor']); }
    public function update(User $user, News $news) { return $user->hasRole(['admin', 'editor']); }
    public function delete(User $user, News $news) { return $user->hasRole('admin'); }
}
```

### Auth Flow
```
Frontend                    Laravel API                  Database
   │                            │                           │
   │  POST /api/v1/auth/login   │                           │
   │  {email, password}         │                           │
   │ ──────────────────────────▶│  Verify credentials       │
   │                            │  Check login attempts     │
   │                            │  Create Sanctum token     │
   │  ◀── {token, user, roles}  │                           │
   │                            │                           │
   │  GET /api/v1/admin/news    │                           │
   │  Authorization: Bearer xxx │                           │
   │ ──────────────────────────▶│  sanctum.auth middleware   │
   │                            │  admin.role middleware     │
   │                            │  Query with user context   │
   │  ◀── {data}                │                           │
```

---

## 5. Phase Breakdown

### **Phase 1: Laravel Project Foundation** ⏱️ ~3 days
> Goal: Empty Laravel project with installation wizard, SQLite support, and core auth

**Tasks:**
- [x] Create Laravel 11 project in `backend/` directory
- [x] Configure for dual SQLite/MySQL database support
- [x] Create installation wizard (`/setup` route):
  - Step 1: Database configuration (host, port, database, username, password)
  - Step 2: Admin account creation (name, email, password)
  - Step 3: Email configuration (SMTP host, port, username, password, from address)
  - Step 4: Application settings (site name, timezone, currency)
  - Step 5: Summary & install (writes `.env`, runs migrations, creates admin)
- [x] Store install status in `.installed` file or `installed` config
- [x] Block all API routes until installation is complete
- [x] Configure Sanctum for SPA authentication
- [x] Create database schema (all 40+ tables as Laravel migrations)

**Testing:** Run `php artisan migrate` with SQLite, visit `/setup`, complete wizard, verify `.env` is written and admin can login.

---

### **Phase 2: Auth System & RBAC** ⏱️ ~3 days
> Goal: Complete authentication matching Supabase Auth behavior

**Tasks:**
- [x] User model with Sanctum tokens
- [x] Login / Register / Logout endpoints
- [x] Password reset flow (email-based)
- [x] Role system: `user_roles` table + `Role` model + `hasRole()` method
- [x] All 10 roles: admin, superadmin, developer, staff, coordinator, finance, ceo, moderator, editor, user
- [x] Role permissions table (`role_permissions`)
- [x] Role help text (`role_help`)
- [x] Email MFA system (`user_email_mfa` + `email_otp_codes`)
- [x] Session management (`user_sessions` + fingerprinting)
- [x] Login attempt tracking (`login_attempts`)
- [x] IP banning system (`ip_bans`)
- [x] Auto-grant admin role to first/super admin email
- [x] Activity logging (`activity_log`)

**Testing:** Register user, login, test role assignment, test MFA flow, test IP tracking, test session management.

---

### **Phase 3: Content Management APIs** ⏱️ ~3 days
> Goal: Public and admin content endpoints

**Tasks:**
- [x] News CRUD (public: published only, admin: all)
- [x] Products CRUD (public: published only, admin: all)
- [x] Activities/Events CRUD + RSVP + view counting
- [x] Media management (photos/videos)
- [x] Hero slides management (site_hero_slides)
- [x] Partner logos management (site_partner_logos)
- [x] Membership resources (tier-gated content)
- [x] File upload handling (images → local storage, replace Supabase Storage)

**Testing:** Seed test data, verify public endpoints return published content only, verify admin endpoints require admin role.

---

### **Phase 4: Membership & Applications** ⏱️ ~3 days
> Goal: Full membership lifecycle

**Tasks:**
- [x] Subscription plans CRUD
- [x] Application forms (dynamic schema-based forms)
- [x] Pending applications with claim tokens
- [x] Membership applications (admin review flow)
- [x] Member profiles (the `member_profiles` table)
- [x] Member ID generation (structured IDs like `FAGE-ASS-26-001`)
- [x] Member documents (file uploads)
- [x] Member email preferences
- [x] Application status workflow (new → reviewing → approved/rejected)
- [x] Directory entries (admin-owned + user-submitted)
- [x] Custom directory fields

**Testing:** Create a plan, submit an application, approve it, verify member profile created with generated ID, test directory submission.

---

### **Phase 5: Payment System** ⏱️ ~3 days
> Goal: Full payment processing matching current integrations

**Tasks:**
- [x] Payment gateway configuration (Paystack, Flutterwave, Hubtel)
- [x] Initialize application payment (anonymous, via claim token)
- [x] Initialize renewal payment (authenticated)
- [x] Paystack inline integration + webhook verification
- [x] Flutterwave inline integration + webhook verification
- [x] Hubtel checkout redirect + callback
- [x] Payment verification by reference
- [x] Payment submission management (admin confirm/reject)
- [x] Bank deposit / manual payment support
- [x] Invoice generation
- [x] Payment receipts

**Testing:** Configure test gateway, initialize payment, verify webhook handling, test payment confirmation flow.

---

### **Phase 6: Member Dashboard** ⏱️ ~2 days
> Goal: All member-facing dashboard functionality

**Tasks:**
- [x] Dashboard summary (profile status, membership status, recent activity)
- [x] Profile editing
- [x] Password change
- [x] Security settings (session management, MFA toggle)
- [x] Certificate viewing & verification
- [x] Readiness checklist (items + responses + scoring)
- [x] My directory listing management
- [x] Resources access (tier-gated)
- [x] Trade opportunities listing + express interest
- [x] Support tickets (create, view, reply)
- [x] Notifications (read/unread)

**Testing:** Login as member, verify all dashboard tabs work, test readiness scoring, test support ticket flow.

---

### **Phase 7: Admin Panel APIs** ⏱️ ~3 days
> Goal: All admin management endpoints

**Tasks:**
- [x] Members management (list, view, edit, approve/reject)
- [x] Applications review workflow
- [x] Payment management (list, confirm, reject, notes)
- [x] Plans management
- [x] Gateways configuration
- [x] Content management (news, products, activities, media)
- [x] Directory management + admin review workflow
- [x] Custom directory fields
- [x] Email templates management
- [x] Email settings (SMTP + Resend configuration)
- [x] Email sending (transactional emails, preference confirmations)
- [x] Chatbot knowledge base management
- [x] Chatbot feedback review
- [x] Certificate templates + batch issuance
- [x] Support tickets (admin view, assign, reply)
- [x] Contact messages
- [x] Roles management (assign/revoke roles)
- [x] User management
- [x] Activity log viewer
- [x] Security settings
- [x] Notification settings + send notifications
- [x] Reports (membership growth, payments, etc.)
- [x] Site content (hero slides, partner logos)

**Testing:** Login as admin, verify all admin endpoints respond correctly with proper authorization.

---

### **Phase 8: Backup System** ⏱️ ~2 days
> Goal: Replicate the Supabase backup system with Laravel

**Tasks:**
- [x] Backup destinations table (Google Drive, local, S3, etc.)
- [x] Backup schedules (frequency, retention)
- [x] Backup runner:
  - [x] `mysqldump` for MySQL / `sqlite3 .backup` for SQLite
  - [x] File-based backup for local storage
  - [ ] Google Drive upload adapter
  - [ ] S3 upload adapter
- [x] Backup runs tracking
- [x] Backup upload results
- [x] Restore from backup
- [x] Scheduled backups via Laravel Task Scheduler
- [x] Admin backup management UI endpoints

**Testing:** Create local backup, verify file is created, schedule a backup, test restore.

---

### **Phase 9: Email & Notifications** ⏱️ ~2 days
> Goal: Transactional email system

**Tasks:**
- [x] Email settings (SMTP, Resend)
- [x] Email templates (block-based template system)
- [x] Email log
- [x] Email preference management endpoint (replaces Edge Function)
- [x] Preference change confirmation emails
- [x] Payment confirmation emails
- [x] Application status emails
- [x] Notification system (in-app notifications)
- [x] Notification reads tracking
- [x] Admin notification settings (chat message recipients)

**Testing:** Configure email settings, send test email, verify email log, test notification creation.

---

### **Phase 10: Trade Opportunities & Chatbot** ⏱️ ~2 days
> Goal: RSS feed system and chatbot

**Tasks:**
- [x] Trade opportunities CRUD
- [x] RSS feed parser (ITC Trade Map) — replaces Edge Function
- [x] Fallback opportunities when feed is down
- [x] Scheduled fetch via Laravel Task Scheduler (replaces pg_cron)
- [x] Trade opportunity interest expressions
- [x] Chatbot knowledge base (already in DB)
- [x] Chatbot feedback collection
- [x] AI chat endpoint (integrate with OpenAI/Gemini API)
- [x] Chat escalation → support ticket creation

**Testing:** Run RSS fetch manually, verify opportunities saved, test chatbot conversation, test escalation.

---

### **Phase 11: Webhooks & External Integrations** ⏱️ ~1 day
> Goal: Payment webhook endpoints

**Tasks:**
- [x] Paystack webhook endpoint (signature verification)
- [x] Flutterwave webhook endpoint (signature verification)
- [x] Hubtel callback endpoint
- [x] Webhook retry/error handling
- [x] Webhook logging

**Testing:** Send test webhooks (use ngrok), verify payment status updates.

---

### **Phase 12: Frontend Adaptation** ⏱️ ~5 days
> Goal: Replace all Supabase client calls with Laravel API calls

**Tasks:**
- [x] Create `apiClient.ts` — fetch wrapper with JWT token management
- [x] Create `api/auth.ts` — login, register, logout, getSession, refreshToken
- [x] Create `api/` modules for each domain:
  - [x] `api/news.ts`, `api/products.ts`, `api/activities.ts`
  - [x] `api/members.ts`, `api/payments.ts`, `api/directory.ts`
  - [x] `api/admin.ts`, `api/chatbot.ts`, `api/trade.ts`
  - [x] `api/notifications.ts`, `api/tickets.ts`
- [x] Replace `AuthProvider.tsx` to use Laravel auth
- [x] Replace all `supabase.from('table')` calls across 100+ files
- [x] Replace all `supabase.auth.*` calls
- [x] Replace server functions (TanStack Start `createServerFn`) with direct API calls
- [x] Update payment inline scripts (Paystack/Flutterwave/Hubtel) for new flow
- [x] Replace Supabase Storage uploads with Laravel file upload endpoints
- [x] Remove `@supabase/supabase-js` dependency
- [x] Remove `supabase/` integration directory
- [x] Update `.env` to use `VITE_API_URL` instead of `VITE_SUPABASE_URL`
- [x] Update Vite config for SPA mode (remove SSR/SSG if not needed)

**Testing:** Full regression test of every page and feature.

---

### **Phase 13: Installation & Bundling** ⏱️ ~2 days
> Goal: Production-ready packages for deployment

**Tasks:**
- [x] Backend bundle:
  - [ ] `composer install --optimize-autoloader --no-dev`
  - [x] Include `.env.example` (not `.env`)
  - [x] Include migration files + seeders
  - [x] Include installation wizard
  - [x] Create `INSTALL.md` with cPanel deployment instructions
- [x] Frontend bundle:
  - [ ] `npm run build` → `dist/` folder
  - [x] `.htaccess` for cPanel SPA routing
  - [ ] `VITE_API_URL` configured for production domain
- [x] Create deployment scripts:
  - [ ] `deploy-backend.sh` — uploads to cPanel, runs composer, sets permissions
  - [ ] `deploy-frontend.sh` — uploads dist/ to cPanel public_html
- [x] Document cPanel setup:
  - [x] PHP version requirements (8.2+)
  - [x] Required PHP extensions
  - [x] `.htaccess` for Laravel routing
  - [ ] MySQL database creation
  - [ ] Cron job for Laravel scheduler

---

## 6. Guided Installation Wizard

The backend will ship with a **web-based setup wizard** accessible at `/setup`.

### Step 1: Server Requirements Check
```
✅ PHP 8.2+          ✅ PDO MySQL/SQLite
✅ JSON extension     ✅ Mbstring extension
✅ Fileinfo           ✅ cURL extension
✅ OpenSSL            ✅ BCMath
✅ .env writable      ✅ storage/ writable
✅ bootstrap/cache/ writable
```

### Step 2: Database Configuration
```
Database Type:  [SQLite ▼] or [MySQL ▼]
───────────────────────────────────────
If MySQL:
  Host:       [localhost         ]
  Port:       [3306              ]
  Database:   [fage_ghana        ]
  Username:   [root              ]
  Password:   [••••••            ]
───────────────────────────────────────
[Test Connection] → ✅ Connected!
```

### Step 3: Admin Account
```
Full Name:     [John Admin        ]
Email:         [admin@fageghana.org]
Password:      [••••••••          ]
Confirm:       [••••••••          ]
```

### Step 4: Email Configuration
```
Mail Driver:   [SMTP ▼] or [Resend API ▼]
───────────────────────────────────────
If SMTP:
  Host:       [smtp.gmail.com    ]
  Port:       [587               ]
  Username:   [noreply@fageghana.org]
  Password:   [••••••            ]
  Encryption: [TLS ▼]
  From:       [noreply@fageghana.org]
  From Name:  [FAGE Ghana        ]
───────────────────────────────────────
If Resend:
  API Key:    [re_xxxx           ]
  From:       [noreply@fageghana.org]
───────────────────────────────────────
[Send Test Email] → ✅ Delivered!
```

### Step 5: Application Settings
```
Site Name:     [FAGE Ghana        ]
Site URL:      [https://fageghana.org]
Currency:      [GHS ▼]
Timezone:      [Africa/Accra ▼]
Super Admin:   [omatazmedia@gmail.com]
```

### Step 6: Install & Confirm
```
Review:
  Database: MySQL @ localhost/fage_ghana ✅
  Admin:    admin@fageghana.org          ✅
  Email:    SMTP via smtp.gmail.com      ✅
  Site:     FAGE Ghana (GHS)             ✅

[🚀 Install Now]

→ Running migrations... (42 tables created)
→ Creating admin user... ✅
→ Seeding default roles... ✅
→ Seeding email templates... ✅
→ Seeding security settings... ✅
→ Writing .env file... ✅
→ Creating .installed marker... ✅

✅ Installation Complete!
   Admin Login: https://yourdomain.com/admin/login
   API Base:    https://yourdomain.com/api/v1
```

---

## 7. Backup System

### Migration from Supabase Backups

The current backup system tracks:
- **Backup destinations** (provider: google_drive, local, s3)
- **Backup schedules** (daily, weekly, monthly with cron)
- **Backup runs** (status, size, tables count, error tracking)
- **Backup run uploads** (per-destination upload results)

### Laravel Implementation

```php
// BackupService.php
class BackupService {
    // Database backup
    public function dumpDatabase(string $format = 'sql'): string {
        if ($this->isSqlite()) {
            return $this->dumpSqlite();
        }
        return $this->dumpMysql();
    }
    
    // Google Drive adapter (reuses current Google Drive OAuth)
    public function uploadToGoogleDrive(string $file, string $folder): array {
        // Uses Google Drive API v3 with OAuth2
    }
    
    // Local file backup
    public function saveLocal(string $file): string {
        return Storage::disk('backups')->put($file);
    }
    
    // Schedule via Laravel Task Scheduler
    // protected function schedule(Schedule $schedule) {
    //     $schedule->call(fn() => BackupService::runScheduled())->daily();
    // }
}
```

### Backup Flow
```
1. Trigger: Manual (admin) or Scheduled (cron)
2. Database dump (mysqldump / sqlite3 backup)
3. Compress to .sql.gz
4. Record backup_run row (status: running)
5. Upload to each enabled destination
6. Record backup_run_upload per destination
7. Update backup_run (status: success/failed, size, etc.)
8. Cleanup old backups based on retention_days
```

---

## 8. Frontend Adaptation Strategy

### Minimal Changes Required

The frontend needs **zero UI changes**. Only the data layer changes:

```
BEFORE:                              AFTER:
─────────                            ─────
supabase.from('news')                fetch(`${API_URL}/v1/news`)
  .select('*')                         .then(r => r.json())
  .eq('published', true)

supabase.auth.signUp({               fetch(`${API_URL}/v1/auth/register`, {
  email, password                      method: 'POST',
})                                      body: JSON.stringify({email, password})

supabase.auth.getSession()           fetch(`${API_URL}/v1/auth/me`, {
                                        headers: { Authorization: `Bearer ${token}` }
                                      })
```

### New File: `src/integrations/api/client.ts`
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) { this.token = token; }

  async request(path: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (res.status === 401) { this.token = null; /* redirect to login */ }
    if (!res.ok) throw await res.json();
    return res.json();
  }

  get(path: string) { return this.request(path); }
  post(path: string, body: any) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); }
  put(path: string, body: any) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); }
  delete(path: string) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
```

### API Endpoint Mapping

| Current Supabase Call | New Laravel Endpoint |
|---|---|
| `supabase.auth.signUp()` | `POST /api/v1/auth/register` |
| `supabase.auth.signInWithPassword()` | `POST /api/v1/auth/login` |
| `supabase.auth.signOut()` | `POST /api/v1/auth/logout` |
| `supabase.auth.getSession()` | `GET /api/v1/auth/me` |
| `supabase.auth.getUser()` | `GET /api/v1/auth/me` |
| `supabase.auth.updateUser()` | `PUT /api/v1/auth/profile` |
| `supabase.auth.resetPasswordForEmail()` | `POST /api/v1/auth/password/forgot` |
| `supabase.from('news').select()` | `GET /api/v1/public/news` |
| `supabase.from('products').select()` | `GET /api/v1/public/products` |
| `supabase.from('activities').select()` | `GET /api/v1/public/activities` |
| `supabase.from('media').select()` | `GET /api/v1/public/media` |
| `supabase.from('directory_entries').select()` | `GET /api/v1/public/directory` |
| `supabase.from('trade_opportunities').select()` | `GET /api/v1/public/trade-opportunities` |
| `supabase.from('member_profiles').select()` | `GET /api/v1/member/profile` |
| `supabase.from('certificates').select()` | `GET /api/v1/member/certificates` |
| `supabase.from('support_tickets').select()` | `GET /api/v1/member/tickets` |
| `supabase.from('admin/*')` | `GET /api/v1/admin/*` |
| `supabase.storage.from('content').upload()` | `POST /api/v1/upload` |
| `supabase.rpc('verify_certificate')` | `GET /api/v1/public/certificates/verify/:code` |
| `supabase.rpc('submit_my_directory_entry')` | `POST /api/v1/member/directory-entry` |
| Edge Function: `fetch-trade-opportunities` | `POST /api/v1/admin/trade-opportunities/fetch` (scheduled) |
| Edge Function: `manage-email-preferences` | `PUT /api/v1/member/email-preferences` |
| Server Function: `initApplicationPayment` | `POST /api/v1/payments/init-application` |
| Server Function: `initRenewalPayment` | `POST /api/v1/payments/init-renewal` |
| Server Function: `verifyPayment` | `POST /api/v1/payments/verify` |
| Webhook: paystack-webhook | `POST /api/v1/webhooks/paystack` |
| Webhook: flutterwave-webhook | `POST /api/v1/webhooks/flutterwave` |
| Webhook: hubtel-callback | `POST /api/v1/webhooks/hubtel` |
| Server Function: `/api/chat` | `POST /api/v1/chat` |

---

## 9. Deployment: cPanel + Laravel

### cPanel Backend Setup

```
cPanel Structure:
├── public_html/                    ← Laravel public/ (document root)
│   ├── index.php                   ← Laravel front controller
│   ├── .htaccess                   ← Rewrite rules
│   └── api/                        ← (if subfolder needed)
├── app/                            ← Laravel app (one level above public)
├── bootstrap/
├── config/
├── database/
├── routes/
├── storage/                        ← Must be writable
│   ├── app/
│   ├── framework/
│   └── logs/
├── .env                            ← Created by installation wizard
├── .installed                      ← Created after setup completes
├── artisan
└── composer.json
```

### cPanel .htaccess
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

### public/.htaccess
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

### cPanel Cron Job
```
* * * * * cd /home/user/app && php artisan schedule:run >> /dev/null 2>&1
```

### Frontend on cPanel
```
public_html/                       ← Vite build output (dist/)
├── index.html
├── .htaccess                      ← SPA fallback
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── ...
```

### Frontend .htaccess (SPA)
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

---

## 10. Testing Strategy

### Per-Phase Testing
Each phase includes:
1. **SQLite development** — all migrations and logic tested against SQLite locally
2. **PHPUnit tests** — unit tests for models, policies, services
3. **API tests** — `Http::` facade tests for every endpoint
4. **MySQL compatibility** — final verification against MySQL before deployment

### Test Categories
```bash
# Unit tests (fast, SQLite)
php artisan test --testsuite=Unit

# Feature tests (SQLite)
php artisan test --testsuite=Feature

# Full regression (MySQL)
php artisan test --env=testing_mysql
```

### Key Test Scenarios
- [x] Installation wizard completes successfully
- [x] Admin can login and access all admin endpoints
- [x] Member can register, login, access member endpoints
- [x] Unauthenticated users can only access public endpoints
- [x] RBAC: each role can only access permitted endpoints
- [x] Payment flow: initialize → webhook → confirm → membership activated
- [x] Backup: create, list, restore
- [x] Email: template rendering, sending, logging
- [x] File upload: images stored and served correctly

---

## Estimated Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Laravel Foundation + Install Wizard | 3 days |
| 2 | Auth + RBAC | 3 days |
| 3 | Content Management APIs | 3 days |
| 4 | Membership & Applications | 3 days |
| 5 | Payment System | 3 days |
| 6 | Member Dashboard APIs | 2 days |
| 7 | Admin Panel APIs | 3 days |
| 8 | Backup System | 2 days |
| 9 | Email & Notifications | 2 days |
| 10 | Trade & Chatbot | 2 days |
| 11 | Webhooks | 1 day |
| 12 | Frontend Adaptation | 5 days |
| 13 | Installation & Bundling | 2 days |
| **Total** | | **~34 days** |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| MySQL/PostgreSQL differences | Test each migration against both SQLite and MySQL |
| UUID handling in MySQL | Use `Str::uuid()` in Laravel, store as `CHAR(36)` |
| PostgreSQL array columns | Convert to JSON columns in MySQL |
| RLS policy accuracy | Port each policy as a Laravel Policy class + test |
| Payment webhook signature verification | Implement exactly as Paystack/Flutterwave/Hubtel docs specify |
| File upload storage differences | Use Laravel filesystem abstraction (local for cPanel, S3 optional) |
| cPanel PHP version | Require PHP 8.2+, check in installation wizard |

---

## Files Modified in Frontend

Only these files need changes (data layer only, zero UI changes):

```
NEW FILES:
src/integrations/api/client.ts          — API client
src/integrations/api/auth.ts            — Auth API calls
src/integrations/api/news.ts            — News API
src/integrations/api/products.ts        — Products API
src/integrations/api/activities.ts      — Activities API
src/integrations/api/media.ts           — Media API
src/integrations/api/members.ts         — Member API
src/integrations/api/payments.ts        — Payment API
src/integrations/api/directory.ts       — Directory API
src/integrations/api/admin.ts           — Admin API
src/integrations/api/chatbot.ts         — Chatbot API
src/integrations/api/trade.ts           — Trade API
src/integrations/api/notifications.ts   — Notification API
src/integrations/api/tickets.ts         — Support tickets API
src/integrations/api/upload.ts          — File upload API
src/integrations/api/settings.ts        — Settings/public config API

MODIFIED FILES:
src/integrations/supabase/client.ts     → src/integrations/api/client.ts (replace)
src/components/auth/AuthProvider.tsx    — Use Laravel auth
src/components/auth/SessionGuard.tsx    — Use Laravel auth
src/components/auth/MfaChallengeDialog.tsx — Use Laravel MFA API
src/routes/login.tsx                    — Use Laravel auth API
src/routes/reset-password.tsx           — Use Laravel password reset API
src/routes/dashboard.tsx                — Use Laravel member API
src/routes/*.tsx (all 60+ route files)  — Replace supabase.from() calls
src/components/**/*.tsx (all components) — Replace supabase imports
src/lib/*.ts (all server functions)      — Replace with API calls or remove
.env                                     — VITE_API_URL replaces VITE_SUPABASE_URL
package.json                            — Remove @supabase/supabase-js

DELETED FILES:
src/integrations/supabase/              — Entire directory (replaced by api/)
src/routes/api/public/*-webhook.ts      — Webhooks move to Laravel
src/routes/api/chat.ts                  — Chatbot moves to Laravel
```

---

*Generated with Codebuff 🤖*
