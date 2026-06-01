-- The Tire Plug — CRM schema v3 (road hazard add-on price per lead)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

alter table leads add column if not exists road_hazard_per_tire numeric;  -- optional add-on $/tire
