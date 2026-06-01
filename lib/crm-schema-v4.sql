-- The Tire Plug — CRM schema v4 (extra services on a quote: alignment, oil, TPMS)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

alter table leads add column if not exists services jsonb;  -- { alignment, oilChange, tpms } prices
