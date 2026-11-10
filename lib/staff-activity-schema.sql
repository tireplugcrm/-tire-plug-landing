-- Staff phone-page activity (owner's "is she using it?" tracker in the admin Belen tab).
-- event: open (unlocked the page) | tab (switched tab, detail = which) | tick / untick (to-do item, detail = the item)
--        | add_account (signed up a business, detail = its name)
create table if not exists staff_activity (
  id bigint generated always as identity primary key,
  who text not null,
  event text not null,
  detail text,
  at timestamptz not null default now()
);
create index if not exists staff_activity_who_at on staff_activity (who, at desc);
alter table staff_activity enable row level security;
