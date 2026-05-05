
# Certificate Designer, Batch Issuance & Dashboard Redesign

## 1. Certificate Template Designer (`/admin/certificates`)

Rebuild as a two-panel visual editor:

**Left panel — Live preview**
- Fixed landscape canvas at standard certificate ratio (e.g. 1414×1000, A4 landscape) with uploaded background image scaled to fit (object-fit cover, locked aspect).
- Overlays rendered absolutely positioned on top: name, member ID, tier, issue date, expiry date, signature image, QR code.
- Each overlay is draggable directly on the canvas (click + drag to reposition); selection highlights the active field.

**Right panel — Field controls**
- Tabs: `Background`, `Fields`, `QR Code`, `Signature`, `Save`.
- **Background**: upload image (stored in `certificate-assets`); auto-detects natural width/height to set canvas dimensions.
- **Fields** (name, member_id, tier, issued, expires, custom lines): per field controls
  - X / Y sliders (also editable via numeric input)
  - Font size slider
  - Font family dropdown (serif, sans, script, mono — Google Fonts loaded)
  - Font weight (normal, bold, 600/700/800)
  - Color picker
  - Alignment (left / center / right)
  - Toggle visible
- **QR Code**: 
  - X/Y/size sliders
  - Style: dots / squares / rounded
  - Foreground & background color pickers
  - Border (none/thin/thick) with color
  - Center logo upload (optional) + size slider
  - Library: switch from `qrcode` to `qr-code-styling` for dot/square/logo options.
- **Signature**: upload PNG, X/Y/width/height sliders, plus authorized name text field with its own font controls.
- **Save**: persists all positions/styles into `certificate_templates.field_positions` JSONB.

A `tier` selector at top picks which template (associate / standard / corporate) is being edited. One template per tier, `is_active`.

**Verification page payload (`/verify/:code`)**
Admin defines (in template settings) which fields to show on the public verification page (name, member ID, tier, expiry, status). Page shows green "Authentic — Active" check if `expires_at > now()` and not revoked, red "Expired" otherwise.

## 2. Certificate Issuance Flow

**Single issue (existing pattern, improved)**
On `/admin/payments` Confirm action, after subscription is extended, automatically:
- Generate `verification_code` (random 12-char).
- Insert `certificates` row using active template for that tier.
- Set `expires_at` = new `subscription_expiry`.
- Notify the member.

**Batch issue (new — `/admin/certificates/issue`)**
- Lists all members whose latest payment is `confirmed` AND who don't yet have an active certificate for current subscription period.
- Checkbox selection + "Issue Certificates" button.
- Admin sets default expiry override (or uses each member's `subscription_expiry`).
- Bulk insert; bulk notify.

**All issued certificates (`/admin/certificates/issued`)**
- Table: member, tier, issued, expires, status (active/expired/revoked), verification code, actions (view, revoke, re-send).
- Filters by tier, status, date range. Search by name/member ID.

## 3. Member Dashboard Redesign (`/dashboard`)

Redesign as card-based overview matching admin style.

**Top: at-a-glance cards**
- Membership Status (active / expiring soon / expired) with colored badge.
- Member ID (large, copy button).
- Subscription expiry + days remaining.
- Latest payment status.

**Tabs / sections below**
- **Overview**: summary cards (applications submitted, payments made count, active certificate, unread notifications, open tickets).
- **My Certificate**: visual preview of issued certificate using same renderer as admin, Download PNG / PDF buttons. Empty state if none yet ("Available once admin confirms payment").
- **Subscription & Renew**: current plan, expiry, renew button (opens payment gateway flow).
- **Payments**: history table with statuses + proof.
- **Profile**: editable contact info.
- **Notifications**: list with mark-as-read.
- **Support**: tickets list + new ticket.

## 4. Admin Overview Redesign (`/admin`)

Replace current landing with card dashboard:
- KPI cards: Total members, Active subscriptions, Expiring in 30 days, Pending payments, Open tickets, Certificates issued (this month).
- Quick action grid: Review payments, Issue certificates, Manage gateways, Send announcement, Add news, Manage products.
- Recent activity feed: last 10 applications, payments, tickets.
- Link to `/admin/reports` (new, placeholder).

## 5. Reports & Analytics (`/admin/reports`)

New empty placeholder page with section stubs:
- Membership growth chart (placeholder)
- Revenue by month (placeholder)
- Certificates issued (placeholder)
- Tickets resolution time (placeholder)
"Coming soon" labels; route registered in admin nav.

## 6. QR Verification Enhancement (`/verify/:code`)

- Loads certificate, shows:
  - Authenticity badge (green check / red X)
  - Member name, member ID, tier, issue date, expiry date
  - "Issued by FAGE Ghana"
- Admin-configurable list of visible fields stored on template `field_positions.verification_display`.

## Technical Details

- **Dependency**: add `qr-code-styling` for advanced QR (dots/squares/logo). Keep `qrcode` for simple cases.
- **Schema additions** (migration):
  - `certificate_templates.field_positions` already JSONB — extend shape to:
    ```
    {
      canvas: { w, h },
      qr: { x, y, size, dotType, fgColor, bgColor, border, logoUrl, logoSize },
      signature: { x, y, w, h },
      fields: { name: { x, y, fontSize, font, weight, color, align, visible }, ... },
      verification_display: ["name","member_id","tier","expires"]
    }
    ```
  - No new tables required.
- **Renderer**: extract canvas render logic from `certificate.$id.tsx` into `src/lib/certificate-render.ts` so both member dashboard preview and admin designer reuse it. Designer uses live DOM overlay for editing; render-to-canvas used only for download.
- **Download**: PNG via canvas `toDataURL`; PDF via `jspdf` (add dependency) embedding the PNG at landscape A4.
- **New routes**:
  - `src/routes/admin.certificates.issue.tsx` (batch)
  - `src/routes/admin.certificates.issued.tsx` (list all)
  - `src/routes/admin.reports.tsx` (placeholder)
  - `src/routes/admin.index.tsx` rebuilt as overview (currently `/admin` shows nav only).
- **Member dashboard**: rewrite `src/routes/dashboard.tsx` using shadcn Tabs + Cards.
- **Admin nav**: add Reports + Issued Certificates + Issue (batch) entries.

## Out of Scope (this round)
- Actual analytics charts (page is placeholder per request).
- Online Paystack/Hubtel checkout (manual gateway flow stays as-is).

After approval I will implement in this order: dependencies → schema migration → render lib → designer page → batch + issued pages → member dashboard redesign → admin overview redesign → reports placeholder → verification page polish.
