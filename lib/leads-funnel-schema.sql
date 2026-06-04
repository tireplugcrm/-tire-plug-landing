-- Lead funnel timestamps. Run once in Supabase. Safe to re-run.
-- Stage is computed live: New -> Quoted -> (30min) Follow-up -> (24h no reply) Cold -> Won (if finalized in TireBase).
alter table leads add column if not exists quoted_at     timestamptz;  -- set when a quote is saved/sent
alter table leads add column if not exists last_reply_at timestamptz;  -- set when the customer replies (SMS/IG)

-- One-time: drop all current ACTIVE (un-finalized) leads into the follow-up sequence now.
-- (31 min back = already past the 30-min "quoted" window, so they show as Follow-up immediately
--  and roll to Cold ~24h from now unless they reply or their TireBase order finalizes.)
update leads
  set quoted_at = now() - interval '31 minutes'
  where quoted_at is null and status in ('new', 'called');
