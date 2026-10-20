/**
 * Daily Tekmetric customer sync (lib/sync-tekmetric-customers.js): emails, marketing consent and
 * recent visits into the customer list. Called by Supabase pg_cron with the random key stored in
 * app_settings 'customers_sync_key' (see lib/customers-tekmetric-schema.sql), or with CRON_SECRET.
 * GET ?probe=1 returns API shapes and counts only (no customer values) to check the mapping.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { tekmetricConfigured } from "../../../lib/tekmetric.mjs";
import { syncTekmetricCustomers, probeTekmetric } from "../../../lib/sync-tekmetric-customers.js";

export const maxDuration = 60;

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function authorized(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (same(got, process.env.CRON_SECRET || "")) return true;
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "customers_sync_key").maybeSingle();
  return (data?.value || "").length >= 32 && same(got, data.value);
}

export default async function handler(req, res) {
  if (!(await authorized(req))) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!tekmetricConfigured()) return res.status(500).json({ error: "Tekmetric isn't connected." });
  try {
    if (req.query.probe) return res.status(200).json(await probeTekmetric());
    const out = await syncTekmetricCustomers();
    return res.status(200).json({ ok: true, ...out });
  } catch (e) {
    console.error("tekmetric customers:", e);
    return res.status(502).json({ error: e.message || "Could not reach Tekmetric." });
  }
}
