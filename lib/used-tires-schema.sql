-- Used tires (takeoffs): one row = one single, double or set, with its own real photos.
-- Staff upload at /takeoffs?k=<key>, the AI reads size/brand/model/DOT, the owner prices it under
-- Admin -> Used tires, and only rows marked 'live' show on /used-tires-los-angeles.

create table if not exists used_tires (
  id uuid primary key default gen_random_uuid(),
  tag int generated always as identity,   -- short number staff and customers say: U12
  batch text unique,                      -- one upload group; stops a double tap saving twice
  status text not null default 'draft' check (status in ('draft', 'live', 'hidden', 'sold')),
  qty int not null default 1 check (qty >= 0),   -- tires left in this group
  qty_start int not null default 1,
  size text,
  brand text,
  model text,
  load_speed text,
  dot_week int,                           -- oldest DOT in the group
  dot_year int,
  tread_32 numeric,                       -- measured tread in 32nds; null until someone measures it
  price_each numeric,
  notes text,                             -- staff only, never public
  photos jsonb not null default '[]',     -- [{ p: full path, t: thumbnail path }], cover first
  read jsonb,
  read_at timestamptz,
  read_error text,
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz
);
create index if not exists used_tires_status on used_tires (status);

-- Server-only (service role); no public policies.
alter table used_tires enable row level security;

-- Public bucket: these photos are shown on the website.
insert into storage.buckets (id, name, public) values ('used-tires', 'used-tires', true) on conflict (id) do nothing;

-- The secret in the upload link.
insert into app_settings (key, value, updated_at) values ('takeoff_upload_key', encode(gen_random_bytes(12), 'hex'), now()) on conflict (key) do nothing;
