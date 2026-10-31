-- Jarvis: the shop's scheduled Claude agents (invoice entry, videos, site checks) ask the owner by text.
-- POST /api/agent { action: "ask" } texts ADMIN_ALERT_PHONE "Reply YES 4821 or NO 4821"; the GHL reply
-- webhook (/api/admin/sms-inbound) matches the reply to the open request.

create table if not exists agent_approvals (
  id uuid primary key default gen_random_uuid(),
  code text not null,                   -- 4 digits the owner texts back
  agent text not null default 'jarvis', -- which agent asked ('invoices', 'videos', ...)
  question text not null,
  details jsonb,                        -- whatever the agent wants to remember with it
  status text not null default 'open',  -- 'open' | 'yes' | 'no' | 'expired'
  answer text,                          -- the owner's whole reply (may carry a correction)
  asked_at timestamptz not null default now(),
  answered_at timestamptz,
  sms_ok boolean
);
create index if not exists agent_approvals_open on agent_approvals (status, asked_at desc);

create table if not exists agent_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  agent text not null,
  message text not null,
  data jsonb
);

alter table agent_approvals enable row level security;
alter table agent_log enable row level security;

-- agent_key: what the scheduled agents send as "Authorization: Bearer <key>".
insert into app_settings (key, value, updated_at) values ('agent_key', encode(gen_random_bytes(24), 'hex'), now()) on conflict (key) do nothing;
