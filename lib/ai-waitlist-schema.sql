-- AI video waitlist (tireplugla.com/ai): The Tire Plug x The AI Plug.
-- Each signup is graded from the questionnaire: no business = X (doesn't qualify),
-- "more customers" = A, "document my story" = B, "teach other people" = C.
-- Server-only, like the other aip_ tables: RLS on, no anon/authenticated access.

create table if not exists public.aip_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  has_business boolean not null,
  business text,                 -- what the business is (name or type)
  instagram text,
  goal text,                     -- customers | story | teach
  grade text not null,           -- A | B | C | X
  qualified boolean not null,
  source text default 'tireplug-story',
  pdf_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists aip_waitlist_grade on public.aip_waitlist (grade, created_at);

alter table public.aip_waitlist enable row level security;
revoke all on public.aip_waitlist from anon, authenticated;
grant all on public.aip_waitlist to service_role;
