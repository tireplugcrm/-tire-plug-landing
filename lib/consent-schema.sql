-- The Tire Plug — marketing consent. Run once in Supabase. Safe to re-run.
-- Every opt-in and opt-out is logged with the exact wording shown, where, when and from which IP:
-- that record is the proof TCPA requires for marketing texts. customers.sms_opt_in / email
-- are the current state the campaign tools read.

create table if not exists marketing_consents (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references customers (id) on delete set null,
  phone       text,               -- last 10 digits
  email       text,
  name        text,
  sms         boolean,            -- true = opted in to marketing texts, false = opted out
  email_ok    boolean,            -- true = opted in to marketing email
  source      text,               -- book-page | deals-page | counter-qr | sms-stop | ...
  wording     text,               -- the consent text the person saw
  ip          text,
  user_agent  text,
  created_at  timestamptz default now()
);
create index if not exists marketing_consents_phone_idx on marketing_consents (phone);
alter table marketing_consents enable row level security;

-- Phone match key for the customer list (raw phones come in many formats).
alter table customers add column if not exists phone10 text
  generated always as (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) stored;
create index if not exists customers_phone10_idx on customers (phone10);
alter table customers add column if not exists sms_opt_in_at timestamptz;
alter table customers add column if not exists consent_source text;
