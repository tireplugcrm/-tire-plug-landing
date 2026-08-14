-- The Tire Plug — Business Costs (overhead) schema. Run once in Supabase. Safe to re-run.
--
-- Powers the "Costs" tab in /admin: the owner enters fixed overhead (rent, payroll,
-- marketing, etc.) and the tab converts the monthly total into a daily break-even
-- target — both in sales-in-the-door and in profit-after-tire-cost.
--
-- Reuses the same table the Finance robot defines in finance-schema.sql, so running
-- either file is enough. `create ... if not exists` means this never clobbers data.

create table if not exists business_costs (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                  -- e.g. "Olympic rent", "Payroll", "Google Ads"
  category   text,                           -- rent | payroll | marketing | utilities | insurance | supplies | other
  amount     numeric not null default 0,     -- the amount for one period (see frequency)
  frequency  text default 'monthly',         -- monthly | weekly | biweekly | yearly | one_time
  cost_date  date,                            -- for one_time entries
  active     boolean default true,
  created_at timestamptz default now()
);

create index if not exists business_costs_active_idx on business_costs (active);
