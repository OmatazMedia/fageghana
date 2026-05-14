## Plan: Associate form PDF + centered download modal + single-gateway flow

### 1. Add the Associate membership PDF
- Copy uploaded `FAGE-Membership-Form-ASSOC.pdf` to `public/forms/FAGE-Membership-Form-ASSOC.pdf`.
- Upload it to the `content` storage bucket via `supabase--storage_upload` so it has a public URL.
- Update `subscription_plans` row for `tier='associate'` → set `application_form_pdf_url` to the public URL (insert tool, no schema change).
- (Standard tier keeps current behaviour — corporate PDF already wired.)

### 2. Seed Associate dynamic form (19 fields from the PDF)
Insert/upsert into `application_forms` (tier=`associate`, published=true) a JSON schema mirroring the PDF:
1. Date • 2. Association Name • 3. Address • 4. Telephone • 5. Fax • 6. Email • 7. Website
8. Bankers (repeatable: name + address, up to 3) • 9. Auditors (name + address)
10. Legal Status (radio: Ltd / Partnership / Sole Prop / Ltd by Guarantee / Cooperative / Branch of Foreign / Agent of Foreign / Other)
11. Type of Activity (checkboxes: Producer-Manufacturer / Producer-Exporter / Manufacturer-Exporter / Exporter / Other)
12. Products • 13. % Exported per Annum
14. Executives (repeatable: name + designation, up to 4)
15. Contact Person / CEO • 16. Location • 17. Postal Address
18. Cert. of Incorporation No + Date • 19. Cert. to Commence Business No + Date
20. No. of Management • No. of Workers
21. File upload: company profile (1 page) — optional

### 3. Centered post-download modal (replace toast)
New component `src/components/membership/PostDownloadModal.tsx`:
- Fixed overlay, dialog centered on screen (`fixed inset-0 grid place-items-center z-50`).
- Shows plan name, the `post_download_message` from DB, an "I've got it" close button, and a small countdown ("Closes automatically in 40s").
- Auto-dismisses after 40 000 ms via `setTimeout` (cleared on manual close/unmount). No outside-click dismiss so users can read it.
- Used in both `src/routes/membership.tsx` and `src/routes/apply.$tier.tsx` (replace current `toast.message(...)` calls).

### 4. Single payment gateway — skip the picker
In `src/routes/apply.$tier.tsx`:
- When only one online (non-`manual_bank`) gateway is enabled, the `pay` step renders a single "Proceed to payment with {gateway.name}" button (one click → `payOnline(g)`), no card grid.
- If `manual_bank` is also enabled, show it as a secondary "Or pay by bank deposit" link below.
- If multiple online gateways exist, keep current grid (future-proof).
- Same simplification applied at the contact-step submit: if exactly one online gateway exists and no manual_bank, auto-advance straight from contact submission into `payOnline()` (skip `pay` step entirely).

### Files touched
- new: `public/forms/FAGE-Membership-Form-ASSOC.pdf`
- new: `src/components/membership/PostDownloadModal.tsx`
- edit: `src/routes/membership.tsx`, `src/routes/apply.$tier.tsx`
- data: storage upload + `subscription_plans` UPDATE + `application_forms` UPSERT (no migrations)

### Out of scope
Per-field admin toggles, signature slots, welcome modal/confetti, backup-restore work — tracked from earlier turns, not touched here.