// The owner's calendar feed for iPhone Calendar (Settings → Calendar → Accounts → Add Subscribed Calendar,
// or tap the webcal:// link on /alex). GET ?k=<app_settings alex_ical_key>. Last 30 days + next 120.
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { setting } from "../../lib/invoices.js";
import { entries, icsFeed } from "../../lib/alex-calendar.js";

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).send("Database not configured.");
  const key = await setting("alex_ical_key");
  if (!key || typeof req.query.k !== "string" || req.query.k !== key) return res.status(404).send("Not found");
  try {
    const items = await entries(new Date(Date.now() - 30 * 864e5), new Date(Date.now() + 120 * 864e5));
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="tire-plug-alex.ics"');
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(icsFeed(items));
  } catch (e) {
    return res.status(500).send(e.message || "Failed");
  }
}
