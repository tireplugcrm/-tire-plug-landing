-- The Tire Plug — Shop Floor / Work Orders. Run once in Supabase. Safe to re-run.

create table if not exists work_orders (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text,
  phone             text,
  vehicle           text,
  service           text,
  location          text,                       -- Olympic | Manchester
  status            text default 'waiting',     -- waiting | in_bay | done
  assigned_staff_id uuid references staff(id) on delete set null,
  note              text,
  started_at        timestamptz,
  done_at           timestamptz,
  archived          boolean default false,
  created_at        timestamptz default now()
);

create index if not exists work_orders_board_idx on work_orders (archived, status, created_at);
