-- Lexi's Commission Tracker (/lexi?k=<key>). Lexi reports the ROs she sold (RO # + RO name);
-- each one is matched to the real Tekmetric repair order to get the products, services and quantities.

create table if not exists commission_reports (
  id uuid primary key default gen_random_uuid(),
  day date not null,                    -- shop (LA) date she reported it
  rep text not null default 'Lexi',
  ro_number text not null,
  ro_name text not null,                -- customer name on the RO, as she typed it
  created_at timestamptz not null default now(),
  status text not null default 'pending', -- 'pending' (not matched yet) | 'matched' | 'no-match'
  lines jsonb,                          -- [{ kind: 'part'|'labor'|'fee', name, qty, amount }] from Tekmetric
  tekmetric_name text,                  -- customer name on the Tekmetric RO
  sold_total numeric(10,2),             -- RO total before tax
  commission numeric(10,2),
  matched_at timestamptz,
  notes text
);
create index if not exists commission_reports_day on commission_reports (day);
create unique index if not exists commission_reports_ro on commission_reports (rep, ro_number);

create table if not exists commission_days (
  day date primary key,
  midday_texted_at timestamptz,
  eod_texted_at timestamptz,
  recap_sent_at timestamptz
);

alter table commission_reports enable row level security;
alter table commission_days enable row level security;

-- commission_key: secret in Lexi's link. commission_text_to: her phone(s). commission_email_to: who gets the recap.
-- commission_rate: share of the RO's LABOR (not parts/tires), e.g. 0.05 for 5%. Blank = no $ amounts yet.
insert into app_settings (key, value, updated_at) values ('commission_key', encode(gen_random_bytes(12), 'hex'), now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('commission_text_to', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('commission_email_to', 'tiredepotplug@gmail.com', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('commission_rate', '', now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('commission_cron_key', encode(gen_random_bytes(24), 'hex'), now()) on conflict (key) do nothing;

-- 12:00 PM text, 5:00 PM text, 7:00 PM recap email (LA). Both UTC hours cover summer and winter;
-- /api/cron/commission only acts in the right LA hour and stamps commission_days so nothing doubles.
select cron.schedule('commission-tick', '0 0,1,2,3,19,20 * * *', $$select net.http_get(url := 'https://tireplugla.com/api/cron/commission', headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from public.app_settings where key = 'commission_cron_key')), timeout_milliseconds := 60000)$$);

-- 2026-10-29: Lexy is the service writer in Tekmetric on ROs she sells (employee 323200, Lexy Reyes).
-- Reports where someone else is the writer get flagged; ROs she wrote but didn't report get added.
alter table commission_reports add column if not exists labor_total numeric(10,2);
alter table commission_reports add column if not exists tekmetric_writer text;
insert into app_settings (key, value, updated_at) values ('commission_writer_id', '323200', now()) on conflict (key) do nothing;
