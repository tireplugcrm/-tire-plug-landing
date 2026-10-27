-- Daily invoice check-in: at 10:00 AM and 4:30 PM (Mon–Sat) the shop gets a text with a link to /invoices.
-- Each day ends with an answer: photos of the day's delivery invoices, or "no deliveries".
-- Files live in the private "invoices" storage bucket; the AI's read of each one is in read.

create table if not exists invoice_days (
  day date primary key,                 -- shop (LA) date
  status text,                          -- 'uploaded' | 'none' | null (not answered yet)
  answered_by text,
  answered_at timestamptz,
  am_texted_at timestamptz,             -- 10:00 AM text went out
  pm_texted_at timestamptz              -- 4:30 PM text went out
);

create table if not exists invoice_uploads (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  path text not null,                   -- storage path in the "invoices" bucket
  file_name text,
  mime text,
  size int,
  uploaded_by text,
  created_at timestamptz not null default now(),
  read jsonb,                           -- { vendor, invoice_no, date, items: [{ brand, model, size, qty, unit_cost }], total, ... }
  read_at timestamptz,
  read_error text,
  entered_at timestamptz,               -- tires entered in Tekmetric
  entered_by text
);
create index if not exists invoice_uploads_day on invoice_uploads (day);

-- Server-only (service role); no public policies.
alter table invoice_days enable row level security;
alter table invoice_uploads enable row level security;

insert into storage.buckets (id, name, public) values ('invoices', 'invoices', false) on conflict (id) do nothing;

-- invoice_upload_key: the secret in the texted link. invoice_text_to: phones that get the text, comma separated.
insert into app_settings (key, value, updated_at) values ('invoice_upload_key', encode(gen_random_bytes(12), 'hex'), now()) on conflict (key) do nothing;
insert into app_settings (key, value, updated_at) values ('invoice_text_to', '', now()) on conflict (key) do nothing;
