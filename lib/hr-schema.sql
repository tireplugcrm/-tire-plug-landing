-- The Tire Plug — People/HR schema (staff roster).
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.
-- This is the foundation for scheduling, clock-in, payroll, and performance.

create table if not exists staff (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  role               text,                       -- e.g. Tire Technician, Manager
  location           text,                       -- Olympic | Manchester
  phone              text,                        -- for shift-reminder texts
  pay_type           text default 'hourly_commission',
  hourly_rate        numeric default 0,           -- base hourly pay
  commission_note    text,                        -- free-text rule, e.g. "$5/tire installed"
  pin                text,                        -- 4-digit clock-in PIN (future kiosk)
  active             boolean default true,
  hired_applicant_id uuid,                        -- links back to the applicant they were hired from
  created_at         timestamptz default now()
);

create index if not exists staff_active_idx on staff (active);

-- Clock in/out punches (Phase 2). One row per shift; clock_out null = still on the clock.
create table if not exists time_punches (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid references staff(id) on delete cascade,
  clock_in   timestamptz not null default now(),
  clock_out  timestamptz,
  location   text,
  created_at timestamptz default now()
);

create index if not exists time_punches_staff_idx on time_punches (staff_id, clock_in desc);
create index if not exists time_punches_open_idx  on time_punches (staff_id) where clock_out is null;

-- Per-rep work log (Phase 3 attribution). Captures who did what, since
-- TireBase doesn't record the salesperson/technician. Feeds performance + commission.
create table if not exists service_log (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid references staff(id) on delete set null,
  service_type text not null,            -- tire | alignment | tpms | oil | brake | lead | other
  qty          numeric default 1,
  amount       numeric,                   -- optional $ (revenue / commission basis)
  note         text,
  logged_at    timestamptz not null default now(),
  created_at   timestamptz default now()
);

create index if not exists service_log_staff_idx on service_log (staff_id, logged_at desc);
create index if not exists service_log_time_idx  on service_log (logged_at desc);

-- Scheduling (Phase 4). One row per assigned shift. Times are plain "HH:MM"
-- strings in shop local time to avoid timezone drift on a date.
create table if not exists shifts (
  id          uuid primary key default gen_random_uuid(),
  staff_id    uuid references staff(id) on delete cascade,
  shift_date  date not null,
  start_time  text,                 -- "09:00"
  end_time    text,                 -- "18:00"
  location    text,
  note        text,
  reminded_at timestamptz,          -- set when the auto-reminder text goes out
  created_at  timestamptz default now()
);

create index if not exists shifts_date_idx on shifts (shift_date);

-- Owner performance rating + notes per staff (Phase 5).
alter table staff add column if not exists rating     int;   -- 1-5, owner's call
alter table staff add column if not exists perf_notes text;
