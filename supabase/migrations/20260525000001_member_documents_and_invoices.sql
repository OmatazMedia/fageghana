-- ============================================================
-- Migration: Member Documents table + Member Invoices view
-- Date: 2026-05-25
-- ============================================================

-- 1. Member documents table
create table if not exists member_documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  name         text not null,
  doc_type     text not null, -- 'business_reg' | 'export_licence' | 'tax_clearance' | 'other'
  file_path    text not null,
  file_size    int,
  uploaded_at  timestamptz default now()
);

alter table member_documents enable row level security;

create policy "members can manage own documents"
  on member_documents for all
  using (auth.uid() = user_id);

-- 2. Member invoices view (confirmed payments with profile + gateway info)
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
