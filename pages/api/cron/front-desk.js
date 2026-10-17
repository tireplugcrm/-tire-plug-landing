/**
 * Front Desk watchdog (unanswered-lead alerts, reminders, tires to order, no-shows).
 * Called daily by Vercel Cron ("Authorization: Bearer <CRON_SECRET>") and every 5 min by
 * Supabase pg_cron, which sends the random key stored in app_settings 'front_desk_cron_key'
 * (generated inside the database, so it never has to be copied anywhere; see lib/frontdesk-schema.sql).
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { runWatchdog } from "../../../lib/front-desk.js";

export const maxDuration = 60;

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function authorized(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (same(got, process.env.CRON_SECRET || "")) return true;
  if (!supabaseAdmin) return false;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "front_desk_cron_key").maybeSingle();
  return (data?.value || "").length >= 32 && same(got, data.value);
}

export default async function handler(req, res) {
  if (!(await authorized(req))) return res.status(401).json({ error: "Unauthorized" });
  try {
    return res.status(200).json({ ok: true, ...(await runWatchdog()) });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
