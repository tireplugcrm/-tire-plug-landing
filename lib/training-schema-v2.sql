-- The Tire Plug — Training v2 (quizzes, grading, time tracking)
-- Run once in Supabase (SQL Editor → New query → paste → Run). Safe to re-run.

-- Each guide can carry a quiz: { questions: [{ q, options:[...4], answer: 0-3 }] }
alter table training_modules add column if not exists quiz jsonb;

-- Progress now records the grade, time, and attempts per employee per guide.
alter table training_progress add column if not exists score              int;
alter table training_progress add column if not exists passed             boolean default false;
alter table training_progress add column if not exists time_spent_seconds int default 0;
alter table training_progress add column if not exists attempts           int default 0;
