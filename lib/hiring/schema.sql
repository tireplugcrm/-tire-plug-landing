-- The Tire Plug — Hiring system schema
-- Run this once in your Supabase project (SQL Editor → New query → paste → Run).
-- Then create a Storage bucket named "resumes" (Storage → New bucket → name: resumes, Private).

create table if not exists applicants (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- basic info
  name        text not null,
  phone       text,
  email       text,
  role        text not null,              -- office_sales | tire_tech | alignment_tech
  role_label  text,

  -- pipeline status
  status      text not null default 'scored',  -- scored | rejected_knockout | needs_review | hired | archived

  -- knockout layer
  knockout_answers jsonb,                 -- { ko_transport: "yes", ... }
  knockout_failed  text[],                -- ids of failed knockout questions

  -- situational survey
  survey_answers jsonb,                   -- { q1_...: "free text", ... }
  graded         jsonb,                   -- per-question grades from scoreAnswer
  trait_scores   jsonb,                   -- rolled-up 0-5 per trait

  -- final scoring
  strength_score numeric,                 -- 0-100 (null if disqualified/rejected)
  band           text,
  disqualified   boolean default false,
  gate_reasons   text[],

  -- resume / certs (stored for human review, never auto-scored)
  resume_path    text,                    -- path in the "resumes" storage bucket
  resume_review  jsonb,                   -- analyzeDocument output

  -- owner workflow
  owner_notes    text,
  reviewed       boolean default false
);

create index if not exists applicants_score_idx on applicants (strength_score desc nulls last);
create index if not exists applicants_status_idx on applicants (status);
create index if not exists applicants_created_idx on applicants (created_at desc);

-- RLS: lock the table down. All access goes through API routes using the
-- service-role key (which bypasses RLS), so no public policies are needed.
alter table applicants enable row level security;
