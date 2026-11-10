// The owner's calendar feed for iPhone Calendar (Settings → Calendar → Accounts → Add Subscribed Calendar,
// or tap the webcal:// links on /alex). GET ?k=<app_settings alex_ical_key>&cal=business|personal
// (no cal = both, the first link handed out). Last 30 days + next 120.
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { setting } from "../../lib/invoices.js";
import { entries, icsFeed, CALENDARS } from "../../lib/alex-calendar.js";

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).send("Database not configured.");
  const key = await setting("alex_ical_key");
  if (!key || typeof req.query.k !== "string" || req.query.k !== key) return res.status(404).send("Not found");
  try {
    const cal = CALENDARS.includes(req.query.cal) ? req.query.cal : null;
    const items = await entries(new Date(Date.now() - 30 * 864e5), new Date(Date.now() + 120 * 864e5), cal);
    const name = cal === "personal" ? "Alex · Personal" : cal === "business" ? "Tire Plug · Business" : "Tire Plug (Alex)";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="alex-${cal || "all"}.ics"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    return res.status(200).send(icsFeed(items, name));
  } catch (e) {
    return res.status(500).send(e.message || "Failed");
  }
}
