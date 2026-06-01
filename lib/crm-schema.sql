-- The Tire Plug — Customer CRM schema (leads, subscribers, email, replies)
-- Run this once in your Supabase project (SQL Editor → New query → paste → Run).
-- This is separate from the hiring `applicants` table and does not touch it.

-- ============================================================
-- LEADS — people who completed the booking form on the website
-- ============================================================
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name           text,
  phone          text,
  email          text,

  vehicle        text,
  tire_size      text,
  tire_type      text,
  service        text,            -- comma-joined list of services they picked
  service_timing text,            -- ASAP | Tomorrow | This Week | This Weekend | Just Pricing
  lead_priority  text,            -- HOT | WARM | SHOPPING
  source         text,
  promo_code     text,
  tags           text[],

  -- owner workflow
  status         text not null default 'new',  -- new | called | booked | dead
  owner_notes    text,

  raw            jsonb            -- full original payload, just in case
);

create index if not exists leads_created_idx  on leads (created_at desc);
create index if not exists leads_status_idx   on leads (status);
create index if not exists leads_priority_idx on leads (lead_priority);

-- ============================================================
-- SUBSCRIBERS — people who completed the discount popup
-- ============================================================
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name    text,
  email   text,
  source  text,
  tags    text[],

  status  text not null default 'active'   -- active | unsubscribed
);

create index if not exists subscribers_created_idx on subscribers (created_at desc);
create unique index if not exists subscribers_email_idx on subscribers (lower(email));

-- ============================================================
-- EMAIL_CAMPAIGNS — a log of every blast you send from the dashboard
-- ============================================================
create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  subject         text,
  body            text,           -- the message you typed (plain text / simple HTML)
  audience        text,           -- leads | subscribers | both
  recipient_count int default 0,
  sent_count      int default 0,
  error_count     int default 0
);

create index if not exists campaigns_created_idx on email_campaigns (created_at desc);

-- ============================================================
-- EMAIL_REPLIES — inbound replies to your blasts (via Resend inbound webhook)
-- ============================================================
create table if not exists email_replies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  from_email  text,
  from_name   text,
  subject     text,
  body        text,
  read        boolean default false,
  raw         jsonb
);

create index if not exists replies_created_idx on email_replies (created_at desc);
create index if not exists replies_from_idx    on email_replies (lower(from_email));

-- ============================================================
-- Lock everything down. All access is through API routes using the
-- service-role key (which bypasses RLS), so no public policies are needed.
-- ============================================================
alter table leads           enable row level security;
alter table subscribers     enable row level security;
alter table email_campaigns enable row level security;
alter table email_replies   enable row level security;
