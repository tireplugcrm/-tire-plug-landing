-- Track when a lead's quote has been pushed into TireBase (for the "In TireBase ✓" badge
-- and to avoid accidental duplicate pushes). Safe to run more than once.
alter table leads add column if not exists tirebase_quote_id text;
alter table leads add column if not exists tirebase_pushed_at timestamptz;
