-- The Tire Plug — admin access control (owner-approved login codes)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

-- Every person who signs in with Google lands here. The OWNER approves each one
-- with a one-time code, and can revoke anyone at any time.
create table if not exists team_access (
  email        text primary key,                 -- lowercased Google email
  name         text,                             -- from Google profile
  status       text not null default 'pending',  -- pending | approved | revoked
  is_owner     boolean default false,            -- owners skip the code + can revoke others
  code         text,                             -- current one-time approval code (cleared once used)
  code_expires timestamptz,                       -- code valid window
  approved_at  timestamptz,
  last_active  timestamptz,                       -- powers the "Recently Active" board
  created_at   timestamptz not null default now()
);

create index if not exists team_access_active_idx on team_access (last_active desc);

-- Seed the owner(s) — auto-approved, never need a code, can approve/revoke others.
insert into team_access (email, name, status, is_owner)
values
  ('alejandro.l@tirexchange.org', 'Alejandro (Owner)', 'approved', true),
  ('tiredepotplug@gmail.com',     'Alex (Owner)',      'approved', true)
on conflict (email) do update set is_owner = true, status = 'approved';

alter table team_access enable row level security;
