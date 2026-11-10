-- The owner's page (/alex with a 4-digit code; also the admin "Alex" tab):
-- daily / weekly / monthly duty lists (app_settings daily_alex, weekly_alex, monthly_alex),
-- and a calendar: meetings he schedules with staff (owner_events) + customer appointments (leads.appointment_at).
-- His iPhone Calendar subscribes to /api/alex-calendar?k=<alex_ical_key>, so everything shows up there.
-- Run once in the Supabase SQL editor. The code and the calendar key are never in this repo.

create table if not exists owner_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  minutes integer not null default 30,
  with_name text,                 -- staff member (Belen, Junior, Lexi, ...) or null
  with_phone text,
  place text,
  notes text,
  texted_at timestamptz,          -- when the invite text went out
  text_error text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists owner_events_starts on owner_events (starts_at);
alter table owner_events enable row level security;
-- business (shop) or personal; customer appointments are always business. Two iPhone calendars: ?cal=business / ?cal=personal.
alter table owner_events add column if not exists calendar text not null default 'business';
-- alarms: minutes before the start to alert, comma list (e.g. '60,30,0'); null = 15 minutes before.
alter table owner_events add column if not exists alarms text;

-- alex_code: the owner's 4-digit code (set by hand). alex_lock: wrong-code counter.
-- alex_ical_key: secret in the iPhone calendar link. alex_people: [{name, phone}] he can schedule with.
insert into app_settings (key, value, updated_at) values ('alex_code', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('alex_ical_key', encode(gen_random_bytes(16), 'hex'), now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('alex_people', '[]', now()) on conflict (key) do nothing;
