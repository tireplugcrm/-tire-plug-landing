-- The Tire Plug — Reviews & Referrals. Run once in Supabase. Safe to re-run.

-- Track who we've asked for a review (so we don't pester).
alter table customers add column if not exists review_requested_at timestamptz;

-- Simple key/value settings (Google review link, booking link, etc.).
create table if not exists app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);
