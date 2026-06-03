-- The Tire Plug — Finance robot schema. Run once in Supabase. Safe to re-run.

-- Cost memory: our cost per tire/line, keyed by a normalized description.
-- Enter once, remembered forever. is_product=false marks labor/service lines (cost usually 0).
create table if not exists tire_costs (
  id         uuid primary key default gen_random_uuid(),
  match_key  text unique not null,          -- normalized description (lowercase, alnum only)
  label      text,                           -- human-readable description as first seen
  brand      text,
  size       text,
  unit_cost  numeric not null default 0,     -- our cost per unit
  is_product boolean default true,           -- false = labor/service
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Operating expenses for the P&L below gross profit (rent, utilities, ads, etc.).
create table if not exists business_costs (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  category   text,                           -- rent | utilities | ads | supplies | insurance | other
  amount     numeric not null default 0,
  frequency  text default 'monthly',         -- monthly | one_time
  cost_date  date,                            -- for one_time entries
  active     boolean default true,
  created_at timestamptz default now()
);

create index if not exists business_costs_active_idx on business_costs (active);
