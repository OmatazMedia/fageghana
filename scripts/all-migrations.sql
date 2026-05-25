-- ============================================================
--  FAGE Ghana — Full SQL Migration Reference
--  All migrations in chronological order
--  Use this file for reference, disaster recovery, or
--  setting up a fresh Supabase project from scratch.
-- ============================================================


-- ============================================================
-- [001] Activity view tracking
-- Source: scripts/add-view-tracking.sql
-- ============================================================

alter table activities
  add column if not exists view_count integer default 0;

create or replace function increment_activity_views(activity_id uuid)
returns integer as $$
declare
  new_count integer;
begin
  update activities
  set view_count = coalesce(view_count, 0) + 1
  where id = activity_id;

  select view_count into new_count
  from activities
  where id = activity_id;

  return new_count;
end;
$$ language plpgsql security definer;

grant execute on function increment_activity_views(uuid) to authenticated;


-- ============================================================
-- [002] Member Documents table
-- Source: supabase/migrations/20260525000001_member_documents_and_invoices.sql
-- Storage bucket required:
--   Name : member-documents
--   Public: false
--   Allowed MIME types: application/pdf, image/*
-- ============================================================

create table if not exists member_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  doc_type     text not null,
  -- doc_type values:
  --   'business_reg'   — Business Registration Certificate
  --   'export_licence' — Export Licence
  --   'tax_clearance'  — Tax Clearance Certificate
  --   'other'          — Any other document
  file_path    text not null,
  file_size    int,
  uploaded_at  timestamptz default now()
);

alter table member_documents enable row level security;

create policy "members can manage own documents"
  on member_documents for all
  using (auth.uid() = user_id);


-- ============================================================
-- [003] Member Invoices view
-- Source: supabase/migrations/20260525000001_member_documents_and_invoices.sql
-- Joins confirmed payment_submissions with member_profiles
-- and payment_gateways for invoice display.
-- ============================================================

create or replace view member_invoices as
select
  ps.id,
  ps.user_id,
  ps.amount,
  ps.currency,
  ps.status,
  ps.reference,
  ps.method,
  ps.kind,
  ps.duration_months,
  ps.confirmed_at,
  ps.created_at,
  mp.company_name,
  mp.contact_name,
  mp.member_id,
  mp.tier,
  pg.name as gateway_name
from payment_submissions ps
left join member_profiles mp on mp.user_id = ps.user_id
left join payment_gateways pg on pg.id = ps.gateway_id
where ps.status = 'confirmed';


-- ============================================================
-- PENDING — Run when ready
-- ============================================================

-- [004] Member Email Preferences (deployed via Lovable edge function)
-- Table created by Supabase edge function: manage-email-preferences
--
-- create table if not exists member_email_preferences (
--   id                 uuid primary key default gen_random_uuid(),
--   user_id            uuid references auth.users(id) on delete cascade not null unique,
--   newsletters        boolean default true,
--   event_alerts       boolean default true,
--   trade_notices      boolean default true,
--   payment_reminders  boolean default true,
--   updated_at         timestamptz default now()
-- );
--
-- alter table member_email_preferences enable row level security;
--
-- create policy "members manage own email prefs"
--   on member_email_preferences for all
--   using (auth.uid() = user_id);
--
-- Edge function: manage-email-preferences
--   POST { user_id, newsletters, event_alerts, trade_notices, payment_reminders }
--   Returns { success: true, updated: <preferences object> }


-- [005] Event RSVPs (for "Events I'm Attending" dashboard tab)
-- Requires: activities table to exist
--
-- create table if not exists event_rsvps (
--   id           uuid primary key default gen_random_uuid(),
--   user_id      uuid references auth.users(id) on delete cascade not null,
--   activity_id  uuid references activities(id) on delete cascade not null,
--   created_at   timestamptz default now(),
--   unique(user_id, activity_id)
-- );
--
-- alter table event_rsvps enable row level security;
--
-- create policy "members manage own rsvps"
--   on event_rsvps for all
--   using (auth.uid() = user_id);


-- ============================================================
-- NOTES
-- ============================================================
-- • All tables use UUID primary keys with gen_random_uuid()
-- • All member-facing tables have RLS enabled
-- • Storage buckets must be created manually in Supabase dashboard
--   (SQL editor cannot create storage buckets)
-- • Edge functions needed for:
--     - Trade Opportunities Board (scheduled fetch/curate)
--     - Email Preferences (transactional trigger on change)
-- ============================================================
