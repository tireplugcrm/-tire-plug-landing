-- Careers — add a hiring-pipeline stage to applicants.
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

-- Pipeline stage, separate from `status` (which handles scored/knockout/archived).
-- Values: new | contacted | interview | trial | hired
alter table applicants add column if not exists stage text default 'new';

-- Backfill: anyone already marked hired keeps that stage; everyone else starts at 'new'.
update applicants set stage = 'hired' where status = 'hired' and (stage is null or stage = 'new');
update applicants set stage = 'new'   where stage is null;
