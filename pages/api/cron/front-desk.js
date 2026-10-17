/**
 * Front Desk watchdog (unanswered-lead alerts, reminders, tires to order, no-shows).
 * Called every 5 min by Supabase pg_cron (see lib/frontdesk-schema.sql) and daily by Vercel Cron.
 * Both send "Authorization: Bearer <CRON_SECRET>".
 */
import { runWatchdog } from "../../../lib/front-desk.js";

export const maxDuration = 60;

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    return res.status(200).json({ ok: true, ...(await runWatchdog()) });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
