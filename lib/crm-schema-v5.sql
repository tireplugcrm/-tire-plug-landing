-- The Tire Plug — CRM schema v5 (Instagram as a native conversation channel)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

-- Leads can now arrive from Instagram DMs, not just the web form / SMS.
alter table leads add column if not exists channel     text default 'web';  -- web | sms | instagram
alter table leads add column if not exists ig_user_id  text;                -- Instagram-scoped sender id (IGSID)

-- Each message knows which channel it went over (so replies route correctly).
alter table lead_messages add column if not exists channel text default 'sms';  -- sms | instagram

create index if not exists leads_ig_idx on leads (ig_user_id);
