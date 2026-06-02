-- The Tire Plug — Training / Onboarding hub (the "company brain")
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

create table if not exists training_modules (
  id uuid primary key default gen_random_uuid(),
  category   text not null,        -- e.g. "Finalizing a POS Order"
  title      text not null,        -- e.g. "How to finalize a POS order"
  content    text,                 -- the step-by-step guide
  sort       int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists training_modules_cat_idx on training_modules (category, sort);

-- Which employee has completed which module.
create table if not exists training_progress (
  id uuid primary key default gen_random_uuid(),
  email        text not null,
  module_id    uuid references training_modules(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (email, module_id)
);

alter table training_modules  enable row level security;
alter table training_progress enable row level security;
