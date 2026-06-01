-- The Tire Plug — CRM schema v2 (quotes, revenue, SMS conversations, reminders)
-- Run this once in Supabase (SQL Editor → New query → paste → Run).
-- Safe to run more than once. Requires the v1 `leads` table to already exist.

-- ── Leads: quotes + revenue tracking ────────────────────────
alter table leads add column if not exists quotes         jsonb;       -- [{brand, price, qty}]
alter table leads add column if not exists revenue_amount numeric;     -- $ when booked
alter table leads add column if not exists booked_at      timestamptz; -- when marked booked

-- ── SMS conversations (two-way texting via Twilio) ──────────
create table if not exists lead_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id    uuid references leads(id) on delete set null,
  direction  text not null,        -- inbound | outbound
  phone      text,                 -- customer number, last-10-digits normalized
  body       text,
  twilio_sid text,
  status     text,
  read       boolean default false -- inbound unread flag (for badges)
);
create index if not exists lead_messages_lead_idx  on lead_messages (lead_id, created_at);
create index if not exists lead_messages_phone_idx on lead_messages (phone);

-- ── Reminders (general follow-up + "tires are in" service reminder) ──
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id    uuid references leads(id) on delete cascade,
  due_at     timestamptz not null,
  note       text,
  kind       text default 'followup',   -- followup | service_ready
  done       boolean default false
);
create index if not exists reminders_due_idx on reminders (due_at) where done = false;

-- Lock down (access only via service-role API routes)
alter table lead_messages enable row level security;
alter table reminders     enable row level security;
