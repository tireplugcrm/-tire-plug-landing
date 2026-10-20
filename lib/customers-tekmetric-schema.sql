-- The Tire Plug — Tekmetric customers in the customer list. Run once in Supabase. Safe to re-run.
-- Tekmetric figures live in tm_* columns (lib/sync-tekmetric-customers.js) so the TireBase sync
-- never overwrites them; customers_merged combines both and is what the app reads.

alter table customers add column if not exists tm_customer_id    text;
alter table customers add column if not exists tm_email          text;
alter table customers add column if not exists tm_ok_marketing   boolean default false;
alter table customers add column if not exists tm_business       boolean default false;
alter table customers add column if not exists tm_first_visit    date;
alter table customers add column if not exists tm_last_visit     date;
alter table customers add column if not exists tm_order_count    int default 0;
alter table customers add column if not exists tm_total_spent    numeric default 0;
alter table customers add column if not exists tm_last_tire_date date;
alter table customers add column if not exists tm_synced_at      timestamptz;
create unique index if not exists customers_tm_id_idx on customers (tm_customer_id);

create or replace view customers_merged with (security_invoker = true) as
select
  c.id, c.tb_customer_id, c.name, c.phone,
  coalesce(c.email, c.tm_email)                              as email,
  least(c.first_visit, c.tm_first_visit)                     as first_visit,
  greatest(c.last_visit, c.tm_last_visit)                    as last_visit,
  coalesce(c.order_count, 0) + coalesce(c.tm_order_count, 0) as order_count,
  coalesce(c.total_spent, 0) + coalesce(c.tm_total_spent, 0) as total_spent,
  greatest(c.last_tire_date, c.tm_last_tire_date)            as last_tire_date,
  c.tire_count, c.is_commercial,
  (coalesce(c.commercial_suggested, false) or coalesce(c.tm_business, false)) as commercial_suggested,
  c.sms_opt_in, c.notes, c.synced_at, c.created_at, c.review_requested_at,
  c.tm_customer_id, c.tm_ok_marketing, c.tm_synced_at
from customers c;

-- Key the daily pg_cron job sends (generated here, never copied anywhere).
insert into app_settings (key, value)
values ('customers_sync_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Daily at 15:00 UTC (8 AM LA), an hour before review requests go out.
select cron.unschedule('tekmetric-customers') where exists (select 1 from cron.job where jobname = 'tekmetric-customers');
select cron.schedule('tekmetric-customers', '0 15 * * *', $$
  select net.http_get(
    url := 'https://tireplugla.com/api/cron/tekmetric-customers',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select value from public.app_settings where key = 'customers_sync_key')),
    timeout_milliseconds := 60000
  );
$$);
