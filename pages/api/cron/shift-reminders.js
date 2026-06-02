/**
 * Shift-reminder cron (Phase 4). Texts each staffer their shift for TODAY.
 * Triggered by Vercel Cron (see vercel.json) — runs once each morning.
 *
 * Auth: Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". We require it
 * so the endpoint can't be triggered by anyone.
 *
 * Idempotent: only shifts with reminded_at = null are texted, and we stamp
 * reminded_at after a successful send (re-runs won't double-text).
 *
 * Note: texts go through the same Twilio number as customer texts, so delivery
 * depends on the A2P campaign being approved.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { sendSms } from "../../../lib/sms.js";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization || "";
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  // Today's date in shop (LA) time as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  const { data: shifts } = await supabaseAdmin
    .from("shifts").select("id, staff_id, shift_date, start_time, end_time, location")
    .eq("shift_date", today).is("reminded_at", null);

  if (!shifts || shifts.length === 0) return res.status(200).json({ ok: true, sent: 0, date: today });

  // Look up phones for the staff on today's shifts.
  const ids = [...new Set(shifts.map((s) => s.staff_id).filter(Boolean))];
  const { data: staff } = await supabaseAdmin.from("staff").select("id, name, phone").in("id", ids);
  const byId = Object.fromEntries((staff || []).map((s) => [s.id, s]));

  let sent = 0;
  for (const sh of shifts) {
    const person = byId[sh.staff_id];
    if (!person || !person.phone) continue;
    const first = (person.name || "").trim().split(/\s+/)[0] || "there";
    const when = [sh.start_time, sh.end_time].filter(Boolean).join("–");
    const where = sh.location ? ` at the ${sh.location} shop` : "";
    const body = `Hi ${first}, reminder from The Tire Plug: you're scheduled today${when ? ` ${when}` : ""}${where}. See you there!`;
    const r = await sendSms({ to: person.phone, body });
    if (r.ok) {
      await supabaseAdmin.from("shifts").update({ reminded_at: new Date().toISOString() }).eq("id", sh.id);
      sent += 1;
    }
  }

  return res.status(200).json({ ok: true, sent, date: today });
}
