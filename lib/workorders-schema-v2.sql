-- The Tire Plug — Shop Floor v2 (TV display, tire/alignment job types, tire size, holds, bays, history). Run once in Supabase
-- after workorders-schema.sql (SQL Editor → New query → paste → Run). Safe to re-run.

alter table work_orders add column if not exists ticket_no    bigserial;            -- short number for the TV and the techs
alter table work_orders add column if not exists job_types    text[] default '{}';  -- tires | used | repair | alignment | rotate | tpms | wheels | other
alter table work_orders add column if not exists tire_size    text;                 -- 225/45R17
alter table work_orders add column if not exists tire_qty     int;
alter table work_orders add column if not exists tire_brand   text;                 -- picked from our shelf (website inventory)
alter table work_orders add column if not exists tire_model   text;
alter table work_orders add column if not exists tire_img     text;                 -- /images/tires/... photo
alter table work_orders add column if not exists bay          text;
alter table work_orders add column if not exists rush         boolean default false;
alter table work_orders add column if not exists waiter       boolean default false; -- customer is waiting in the shop
alter table work_orders add column if not exists promised_at  timestamptz;
alter table work_orders add column if not exists parts_status text default 'na';    -- tires: na | in_stock | ordered | arrived
alter table work_orders add column if not exists hold_reason  text;                 -- approval | parts | customer | other
alter table work_orders add column if not exists hold_since   timestamptz;
alter table work_orders add column if not exists picked_up_at timestamptz;
alter table work_orders add column if not exists updated_at   timestamptz default now();
-- status: waiting | in_bay | on_hold | done (ready for pickup); archived = picked up

create index if not exists work_orders_done_idx on work_orders (done_at) where done_at is not null;

-- Every stage change, for turnaround and bottleneck reports later.
create table if not exists work_order_events (
  id            bigserial primary key,
  work_order_id uuid references work_orders(id) on delete cascade,
  from_status   text,
  to_status     text,
  note          text,
  by_name       text,
  created_at    timestamptz not null default now()
);
create index if not exists work_order_events_wo_idx on work_order_events (work_order_id, created_at);
alter table work_order_events enable row level security;
alter table work_orders enable row level security;

-- The TV display link carries this key (/shop-tv?key=...). The database makes it; nobody copies a secret.
-- To cut off old TV links, delete this row and run the insert again.
insert into app_settings (key, value)
values ('shop_tv_key', replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;
