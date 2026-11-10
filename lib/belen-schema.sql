-- Belen's field-rep tracker (/belen with her 4-digit code; editable from the admin "Belen" tab).
-- Plan (owner, 2026-11-09, "Belen Field Rep Bonus Plan"): she keeps $27.50/hr (normal payroll) and a gas card,
-- and earns a monthly bonus on the PROFIT her business accounts bring in:
--   - first 90 days: 10% of new-account profit from the first dollar
--   - after that: 15% of new-account profit above the line ($5,000 of profit a month, about her wage)
--   - accounts the shop already had (USC, city businesses, tow companies): 5%, and they count toward the line
--   - $50 per new account once it qualifies ($500 spent with us, or 20 wheels sold to us)
-- Profit is entered by the owner per paid invoice / RO / scrap ticket (no costs are stored, only profit).
-- Run this once in the Supabase SQL editor. Rates and dates are app_settings so they can change without code.

create table if not exists rep_accounts (
  id uuid primary key default gen_random_uuid(),
  rep text not null,
  name text not null,
  kind text not null default 'fleet',      -- wheels | fleet | tires | commercial
  existing boolean not null default false, -- the shop already had this business (counts at the lower rate)
  contact text,
  phone text,
  notes text,
  signed_on date not null default current_date,
  qualified_on date,                       -- the day it hit $500 spent or 20 wheels ($50 bonus that month)
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists rep_accounts_rep on rep_accounts (rep);

create table if not exists rep_profit (
  id uuid primary key default gen_random_uuid(),
  rep text not null,
  account_id uuid not null references rep_accounts(id) on delete cascade,
  day date not null,
  kind text not null default 'fleet',      -- wheels | fleet | tires | commercial
  ref text,                                -- invoice / RO / scrap ticket number
  profit numeric(10,2) not null,           -- what the shop kept on the PAID invoice (labor counts in full)
  note text,
  created_at timestamptz not null default now()
);
create index if not exists rep_profit_rep_day on rep_profit (rep, day);

alter table rep_accounts enable row level security;
alter table rep_profit enable row level security;

-- belen_code: her 4-digit code (set it here by hand, never in the repo). belen_lock: wrong-code counter.
insert into app_settings (key, value, updated_at) values ('belen_code', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('belen_start', '2026-11-10', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('belen_plan', '{"line":5000,"rate":0.15,"existingRate":0.05,"introRate":0.10,"introDays":90,"newAccountBonus":50,"hourly":27.5}', now()) on conflict (key) do nothing;
