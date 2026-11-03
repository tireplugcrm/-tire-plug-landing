-- Phone AI (Mary): one row per call, written by /api/voice-calls when ElevenLabs finishes the call.
-- Facts come from what the agent actually did (its tool calls: quotes, bookings, leads, texts,
-- transfers); intent, upsells and objections come from ElevenLabs' read of the call (data collection);
-- quality comes from ElevenLabs' evaluation criteria. Recordings live in the private "phone-calls" bucket.

create table if not exists phone_calls (
  id text primary key,                    -- ElevenLabs conversation_id
  started_at timestamptz not null,
  duration_secs integer,
  caller text,                            -- 10 digits
  caller_name text,
  status text,                            -- ElevenLabs status ('done', 'failed')
  ended_by text,                          -- termination reason
  intent text,                            -- new_tires | used_tires | alignment_only | flat_repair | other_service | existing_job | business | vendor | other
  vehicle text,
  tire_size text,
  urgency text,                           -- today | this_week | shopping | unknown
  language text,                          -- en | es
  quoted boolean not null default false,  -- check_tires ran
  quotes jsonb,                           -- [{ size, in_stock: [...], next_day: [...] }] exactly as quoted
  in_stock boolean,                       -- we had the size on the shelf
  lowest_quote numeric,
  booked boolean not null default false,  -- book_appointment succeeded
  booking jsonb,                          -- { when, tire, price, quantity, size, availability }
  booked_value numeric,                   -- tires x price (before install/tax)
  lead_saved boolean not null default false,
  text_sent boolean not null default false,
  transferred boolean not null default false,
  transfer_reason text,
  alignment_offered boolean,
  alignment_accepted boolean,
  alignment_question boolean,             -- the caller asked about alignment
  used_tire_request boolean,
  used_tire_size text,
  objection text,                         -- price | thinking | walk_in | other | none
  lost_reason text,                       -- why it didn't book, in a few words
  quality_score integer,                  -- 0-100: share of quality checks passed
  quality jsonb,                          -- { check: { result, rationale } }
  summary text,
  transcript jsonb,
  data jsonb,                             -- raw data collection results
  cost_credits integer,
  avg_wait_secs numeric,                  -- how long callers waited for Mary to answer each turn
  recording_path text,                    -- phone-calls bucket
  created_at timestamptz not null default now()
);
create index if not exists phone_calls_started on phone_calls (started_at desc);
-- Test calls (made while setting Mary up) stay in the table but out of every report.
alter table phone_calls add column if not exists test boolean not null default false;
alter table phone_calls enable row level security;

insert into storage.buckets (id, name, public) values ('phone-calls', 'phone-calls', false) on conflict (id) do nothing;
