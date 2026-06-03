-- The Tire Plug — Customer reactivation engine. Run once in Supabase. Safe to re-run.
-- Profiles are built from TireBase order history (phones only; TireBase has no emails).
-- Manual fields (email, is_commercial, sms_opt_in, notes) are preserved across syncs.

create table if not exists customers (
  id                   uuid primary key default gen_random_uuid(),
  tb_customer_id       text unique,            -- TireBase customer_id, or "p:<phone>" fallback
  name                 text,
  phone                text,
  email                text,                    -- manual (TireBase doesn't provide)
  first_visit          date,
  last_visit           date,
  order_count          int default 0,
  total_spent          numeric default 0,
  last_tire_date       date,
  tire_count           numeric default 0,
  is_commercial        boolean default false,   -- you confirm
  commercial_suggested boolean default false,   -- auto-detected (name/volume)
  sms_opt_in           boolean default false,
  notes                text,
  synced_at            timestamptz,
  created_at           timestamptz default now()
);

create index if not exists customers_last_visit_idx  on customers (last_visit);
create index if not exists customers_last_tire_idx   on customers (last_tire_date);
create index if not exists customers_commercial_idx  on customers (is_commercial);

-- Reactivation campaign log (who we sent what, to which segment).
create table if not exists customer_campaigns (
  id         uuid primary key default gen_random_uuid(),
  segment    text,
  channel    text,                 -- sms | email
  subject    text,                  -- email only
  body       text,
  recipients int default 0,
  sent       int default 0,
  created_at timestamptz default now()
);
