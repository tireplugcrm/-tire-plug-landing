-- Emilio's Pay Tracker (/emilio, 4-digit code; editable from the admin "Emilio pay" tab).
-- Emilio works every Saturday and Sunday. Pay = hours x hourly rate + commission (5% of LABOR on his ROs,
-- app_settings commission_rate, same as Lexi). Paid once a month, on the 1st, for the month before.
-- His ROs live in commission_reports with rep = 'Emilio' (status 'matched', labor_total, commission).

create table if not exists rep_shifts (
  rep text not null,
  day date not null,
  hours numeric(5,2) not null default 0,  -- 0 = didn't work that day
  note text,
  updated_at timestamptz not null default now(),
  primary key (rep, day)
);

create table if not exists rep_payouts (
  rep text not null,
  month date not null,                    -- first day of the month the pay is for
  amount numeric(10,2) not null,
  paid_at timestamptz not null default now(),
  primary key (rep, month)
);

alter table rep_shifts enable row level security;
alter table rep_payouts enable row level security;

-- emilio_code: the 4-digit code (set it in the SQL editor, never in this repo).
-- emilio_hourly: $/hour. emilio_start: first day he worked (no shifts before it).
-- emilio_tech_id: his Tekmetric employee id once his account exists (to find his ROs by technician).
-- emilio_lock: wrong-code counter, so the 4 digits can't be guessed.
insert into app_settings (key, value, updated_at) values ('emilio_code', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('emilio_hourly', '22', now()) on conflict (key) do nothing;
-- emilio_usual: his usual hours by weekday (6 = Sat 10-7 less 30 min lunch, 0 = Sun 10-4, no lunch).
insert into app_settings (key, value, updated_at) values ('emilio_usual', '{"6": 8.5, "0": 6}', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('emilio_start', '2026-11-07', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('emilio_tech_id', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('emilio_lock', '{}', now()) on conflict (key) do nothing;
