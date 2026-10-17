-- The Tire Plug — Front Desk agent (online appointments, confirmations, reminders, lead watchdog)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to run again.

alter table leads add column if not exists appointment_at    timestamptz;
alter table leads add column if not exists appt_status       text;   -- confirmed | checked_in | done | no_show | canceled
alter table leads add column if not exists appt_token        text;   -- secret for the customer's reschedule/cancel link
alter table leads add column if not exists appt_booked_at    timestamptz;  -- when the current time was picked (reminder timing)
alter table leads add column if not exists first_response_at timestamptz;  -- a person (not the auto-text) handled it
alter table leads add column if not exists tires_ordered_at  timestamptz;
alter table leads add column if not exists work_order_id     uuid;
create index if not exists leads_appt_idx  on leads (appointment_at) where appointment_at is not null;
create unique index if not exists leads_appt_token_idx on leads (appt_token) where appt_token is not null;

-- What the agent did and noticed. `key` makes one-off actions (an alert, a reminder) happen once.
create table if not exists front_desk_events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  lead_id    uuid references leads(id) on delete cascade,
  type       text not null,   -- new_lead | booked | confirmation | reminder | alert | no_show | checked_in | done | canceled | rescheduled
  message    text,
  key        text unique
);
create index if not exists front_desk_events_created_idx on front_desk_events (created_at desc);
alter table front_desk_events enable row level security;

-- Old leads already handled by someone count as answered.
update leads set first_response_at = coalesce(booked_at, created_at)
where first_response_at is null and status <> 'new';

-- ============================================================
-- Run the watchdog every 5 minutes (Vercel's free plan only allows daily crons).
-- 1) Database → Extensions: enable pg_cron and pg_net.
-- 2) Replace YOUR_CRON_SECRET with the CRON_SECRET value from Vercel, then run:
--
-- select cron.schedule('front-desk-watchdog', '*/5 * * * *', $$
--   select net.http_get(
--     url := 'https://tireplugla.com/api/cron/front-desk',
--     headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
--   );
-- $$);
-- ============================================================
