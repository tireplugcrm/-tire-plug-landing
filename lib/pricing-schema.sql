-- The Tire Plug — in-stock tires and prices on autopilot (lib/pricing.js, admin → Pricing).
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to run again.
-- Only the server (service-role key) reads these tables: row-level security is on with no policies.
-- Needs app_settings (lib/reviews-schema.sql).

-- What's on the racks. Public fields + private cost and unit count (never sent to a page).
create table if not exists tire_stock (
  id              text primary key,          -- normalized brand|model|size|lt|p (lib/pricing-engine.js tireId)
  brand           text not null,
  model           text not null,
  size_key        text not null,             -- 265/70R16, 35X12.50R20
  rim             numeric,                   -- 17, or 19.5 for commercial sizes
  lt              boolean not null default false,
  level           text,                      -- in | low
  specs           jsonb,
  available       int,                       -- private
  cost            numeric,                   -- private: unit-weighted cost from Tekmetric
  active          boolean not null default true,  -- false = sold out
  source          text,                      -- tekmetric-api | tekmetric-csv
  first_seen      timestamptz,
  last_seen       timestamptz,
  cost_updated_at timestamptz
);
create index if not exists tire_stock_active_idx on tire_stock (active, size_key);
alter table tire_stock enable row level security;
-- Commercial sizes have half-inch rims (245/70R19.5); tables created before that stored rim as int.
alter table tire_stock alter column rim type numeric;

-- The owner's per-tire overrides.
create table if not exists tire_prices (
  id          text primary key,
  brand       text, model text, size_key text, lt boolean,
  price       numeric,                       -- null = default (catalog price or cost + markup)
  price_note  text,                          -- short public label under the price
  hidden      boolean not null default false,  -- true = "text for price"
  updated_by  text,
  updated_at  timestamptz
);
alter table tire_prices enable row level security;

-- Markup rules. Blank fields match anything; the rule naming the most fields wins.
create table if not exists pricing_rules (
  id       bigserial primary key,
  name     text,
  brand    text,
  lt       boolean,
  min_rim  int,
  max_rim  int,
  markup   numeric not null,
  active   boolean not null default true
);
alter table pricing_rules enable row level security;

-- Changes waiting to be published (one per thing being changed).
create table if not exists pricing_drafts (
  id          bigserial primary key,
  kind        text not null,                 -- tire | setting | rule
  target      text not null,
  change      jsonb not null,
  created_by  text,
  via         text,                          -- admin | agent
  created_at  timestamptz not null default now(),
  unique (kind, target)
);
alter table pricing_drafts enable row level security;

-- Every publish, with the values it replaced, for undo.
create table if not exists price_publishes (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  who        text,
  via        text,
  note       text,
  summary    text,
  items      jsonb,
  effects    jsonb,
  before     jsonb,
  undone_at  timestamptz,
  undone_by  text
);
alter table price_publishes enable row level security;

-- The price every page should show right now; the autopilot keeps it in line with the rules and
-- checks the live pages against it. held_price = a big jump waiting for the owner's OK.
create table if not exists site_prices (
  id             text primary key,
  slug           text,
  price          numeric,
  note           text,
  source         text,                       -- owner | catalog | markup | hidden | none
  rule           text,
  flags          jsonb,
  held_price     numeric,
  accepted_price numeric,
  updated_at     timestamptz
);
alter table site_prices enable row level security;

-- Everything that changed, and who or what changed it.
create table if not exists site_changes (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  who        text,
  via        text,                           -- admin | agent | autopilot
  action     text,
  target     text,
  detail     jsonb
);
create index if not exists site_changes_created_idx on site_changes (created_at desc);
alter table site_changes enable row level security;

-- Site agent conversations (admin → Pricing).
create table if not exists agent_chats (
  id         text primary key,
  who        text,
  title      text,
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table agent_chats enable row level security;

-- Defaults. In-stock prices start OFF; turn them on in admin → Pricing.
insert into app_settings (key, value) values
  ('stock_prices_live', 'false'),
  ('stock_markup', '20'),
  ('price_rounding', 'whole'),
  ('price_min_profit', '10'),
  ('price_max_jump_pct', '35')
on conflict (key) do nothing;

-- ============================================================
-- Run the pricing autopilot every 10 minutes (Vercel's plan only allows daily crons; the daily one
-- in vercel.json is the backstop that texts you if this schedule stops). The database makes its own
-- random key (nobody copies a secret); /api/cron/pricing checks it against app_settings.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;
insert into app_settings (key, value)
values ('pricing_cron_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;
select cron.schedule('pricing-autopilot', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://tireplugla.com/api/cron/pricing',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from public.app_settings where key = 'pricing_cron_key')),
    timeout_milliseconds := 60000
  );
$$);
