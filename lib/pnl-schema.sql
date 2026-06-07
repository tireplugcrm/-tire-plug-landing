-- The Tire Plug — Weekly P&L tracker. Run once in Supabase. Safe to re-run.
-- Stores parsed invoices from the daily Sales Journal + Sales Detail PDFs.
-- Costs are NOT stored here — they live in tire_costs (shared with the Finance robot),
-- so filling a cost once updates every P&L that uses that tire.

create table if not exists pnl_invoices (
  id             uuid primary key default gen_random_uuid(),
  biz_date       date not null,
  inv_no         text not null,           -- Sales Journal number, e.g. A-12835
  detail_no      text,                    -- Sales Detail number, e.g. #16963
  rep            text,
  customer       text,
  cust_type      text,
  payment_method text,
  subtotal       numeric default 0,       -- pre-tax retail
  tax            numeric default 0,
  fet            numeric default 0,
  total          numeric default 0,
  lines          jsonb default '[]'::jsonb,  -- parsed line items (tires/labor/alignment/tpms)
  matched        boolean default true,    -- did we find a matching Sales Detail entry?
  created_at     timestamptz default now(),
  unique (biz_date, inv_no)
);

create index if not exists pnl_invoices_date_idx on pnl_invoices (biz_date);
