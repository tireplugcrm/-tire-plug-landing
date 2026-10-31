-- The Tire Plug — Shop Floor v3: the rest of a Tekmetric repair order on each check-in. Run once in Supabase
-- after workorders-schema-v2.sql (SQL Editor → New query → paste → Run). Safe to re-run.
-- ro = { email, plate, vin, mileage, concern, tire_price, labor: [{ job, desc, price }], fees: [{ desc, price }] }
-- Prices are what the customer pays (typed by the front desk). Never shown on the shop TVs.

alter table work_orders add column if not exists ro jsonb;
notify pgrst, 'reload schema';
