-- The Tire Plug — email marketing upgrade (unsubscribes, business outreach, scheduling, stats)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to run again.

-- Everyone who must never get marketing email again (unsubscribed, bounced, marked spam).
create table if not exists email_suppressions (
  email      text primary key,            -- always lowercase
  reason     text not null default 'unsubscribed',  -- unsubscribed | bounced | complained
  created_at timestamptz not null default now()
);

-- Local businesses for cold outreach (fleets, dealers, contractors, rideshare, etc).
create table if not exists business_prospects (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  business_name   text not null,
  contact_name    text,
  email           text,
  phone           text,
  category        text,                   -- e.g. Auto dealer, Landscaping, Delivery fleet
  address         text,
  website         text,
  notes           text,
  status          text not null default 'new',  -- new | emailed | replied | customer | not_interested | unsubscribed | bounced
  touches         int  not null default 0,      -- emails sent so far (1 = intro, 2 = follow-up)
  last_emailed_at timestamptz,
  replied_at      timestamptz
);
create unique index if not exists prospects_email_idx on business_prospects (lower(email));
create index if not exists prospects_status_idx on business_prospects (status);

-- Campaign log gets scheduling, the template used, featured tires, and live stats.
alter table email_campaigns add column if not exists kind      text default 'blast';   -- blast | customers | outreach | welcome
alter table email_campaigns add column if not exists status    text default 'sent';    -- scheduled | sending | sent | failed | canceled
alter table email_campaigns add column if not exists send_at   timestamptz;
alter table email_campaigns add column if not exists headline  text;
alter table email_campaigns add column if not exists tire_ids  text[];
alter table email_campaigns add column if not exists delivered int default 0;
alter table email_campaigns add column if not exists opened    int default 0;
alter table email_campaigns add column if not exists clicked   int default 0;
alter table email_campaigns add column if not exists bounced   int default 0;
alter table email_campaigns add column if not exists created_by text;

-- One row per (campaign, recipient, event) from Resend webhooks; counts above are derived from it.
create table if not exists email_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  campaign_id uuid,
  email       text,
  type        text,                       -- delivered | opened | clicked | bounced | complained
  link        text
);
create unique index if not exists email_events_once_idx on email_events (campaign_id, email, type);

alter table email_suppressions enable row level security;
alter table business_prospects enable row level security;
alter table email_events       enable row level security;
