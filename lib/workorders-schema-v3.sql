-- The Tire Plug — Shop Floor v3: the rest of a Tekmetric repair order on each check-in. Run once in Supabase
-- after workorders-schema-v2.sql (SQL Editor → New query → paste → Run). Safe to re-run.
-- ro = { plate, vin, mileage, concern, source, techs[], positions[], rotation, tire_price, labor: [{ job, desc, price }] }
-- Prices are what the customer pays (typed by the front desk). The TVs get only techs, wheels and rotation.

alter table work_orders add column if not exists ro jsonb;
notify pgrst, 'reload schema';
