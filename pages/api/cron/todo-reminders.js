/**
 * To-do reminder texts for staff phone pages (Belen first). Vercel Cron runs this every hour; it only
 * texts at the reminder hours (shop time) on work days, and only if items are still open, so a finished
 * list means no text. The wording follows how far along she is. Each text is logged in staff_activity
 * ("reminder"), so the owner sees it in the admin "Is Belen using it?" card.
 *
 * Auth: Vercel Cron's "Authorization: Bearer <CRON_SECRET>". An admin login can POST { preview: true }
 * to see the text that would go out right now, without sending.
 *
 * Settings (app_settings todo_remind, JSON; defaults below):
 *   { "belen": { "on": true, "days": [1,2,3,4,5,6], "hours": [11, 14, 17] } }   days: 0 = Sunday
 * Sent marker: app_settings todo_remind_sent = { "belen": "YYYY-MM-DD@HH" } (one text per slot).
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { setting, shopDay, shopClock } from "../../../lib/invoices.js";
import { people } from "../../../lib/alex-calendar.js";
import { sendSms } from "../../../lib/sms.js";
import { logActivity } from "../../../lib/staff-activity.js";
import { tasksForDay, ticksForDay } from "../../../lib/todo-days.js";

const DEFAULTS = { belen: { on: true, days: [1, 2, 3, 4, 5, 6], hours: [11, 14, 17], name: "Belen", page: "tireplugla.com/belen" } };
const short = (t, n = 45) => { t = String(t).replace(/\*\*/g, "").trim(); if (t.length <= n) return t; const cut = t.slice(0, n); return `${cut.slice(0, cut.lastIndexOf(" ") > 20 ? cut.lastIndexOf(" ") : n).replace(/[,.;:]$/, "")}…`; };

/** Open / done / scratched items that count today (repeating sections plus today's dated section). */
async function progress(who) {
  const { data } = await supabaseAdmin.from("app_settings").select("value, updated_at").eq("key", `todo_${who}`).maybeSingle();
  let v = {};
  try { v = JSON.parse(data?.value || "{}"); } catch { v = {}; }
  const today = shopDay(0);
  const tasks = tasksForDay(v.text, today).map((t) => t.text);
  const lastDay = v.period || (data?.updated_at ? shopDay(0, new Date(data.updated_at)) : today);
  const ticks = ticksForDay({ text: v.text, done: v.done, skipped: v.skipped, lastDay, today });
  const done = new Set(ticks.done), skipped = new Set(ticks.skipped);
  return {
    total: tasks.length,
    done: tasks.filter((t) => done.has(t)).length,
    skipped: tasks.filter((t) => skipped.has(t) && !done.has(t)).length,
    open: tasks.filter((t) => !done.has(t) && !skipped.has(t)),
  };
}

/** The text for this point in the day: first reminder, midday, or end of day. */
export function message({ name, page, slot, slots, p }) {
  const first = slot === 0, last = slot === slots - 1;
  const left = p.open.length;
  const list = p.open.slice(0, 3).map((t) => short(t)).join("; ") + (left > 3 ? ` (+${left - 3} more)` : "");
  if (first) {
    return p.done + p.skipped === 0
      ? `Morning ${name}! Your list has ${p.total} things today, none checked off yet. Start with "${short(p.open[0], 60)}". Check each one off as you finish, or scratch it if it isn't happening: ${page}`
      : `Hi ${name}, you're at ${p.done} of ${p.total} on today's list. Next up: "${short(p.open[0], 60)}". Check it off or scratch it: ${page}`;
  }
  if (last) return `Before you leave, ${name}: ${left} item${left === 1 ? "" : "s"} still open on today's list (${list}). Check ${left === 1 ? "it" : "them"} off or scratch ${left === 1 ? "it" : "them"} so the list is clean: ${page}`;
  return p.done === 0
    ? `${name}, nothing's checked off on today's list yet. Still open: ${list}. Check them off as you go, or scratch what isn't happening: ${page}`
    : `${name}, ${p.done} of ${p.total} done, nice. Still open: ${list}. Check them off or scratch them: ${page}`;
}

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  const preview = req.method === "POST" && !!req.body?.preview;
  if (preview) {
    if (!(await requireAdmin(req)).ok) return res.status(401).json({ error: "Unauthorized" });
  } else {
    const secret = process.env.CRON_SECRET;
    if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  }

  let cfg = {};
  try { cfg = JSON.parse((await setting("todo_remind")) || "{}"); } catch { cfg = {}; }
  let sent = {};
  try { sent = JSON.parse((await setting("todo_remind_sent")) || "{}"); } catch { sent = {}; }
  const { hour, weekday } = shopClock();
  const day = shopDay(0);
  const out = [];

  for (const [who, def] of Object.entries(DEFAULTS)) {
    const c = { ...def, ...(cfg[who] || {}) };
    const hours = [...c.hours].sort((a, b) => a - b);
    // Preview: the slot that's now, or else the next one today (or the first).
    const slot = preview ? Math.max(0, hours.findIndex((h) => h >= hour)) : hours.indexOf(hour);
    const p = await progress(who);
    const body = p.open.length ? message({ name: c.name, page: c.page, slot: slot < 0 ? 0 : slot, slots: hours.length, p }) : null;
    if (preview) { out.push({ who, hours, days: c.days, progress: p, text: body || "(nothing open, so no text)" }); continue; }

    if (!c.on || !c.days.includes(weekday) || slot < 0) { out.push({ who, skipped: "not a reminder time" }); continue; }
    const mark = `${day}@${hour}`;
    if (sent[who] === mark) { out.push({ who, skipped: "already sent" }); continue; }
    if (!body) { out.push({ who, skipped: "list done" }); continue; }
    const phone = (await people()).find((x) => x.name.toLowerCase() === c.name.toLowerCase())?.phone;
    if (!phone) { out.push({ who, skipped: "no phone saved" }); continue; }
    const r = await sendSms({ to: phone, body });
    if (r.ok) {
      sent[who] = mark;
      await logActivity(who, "reminder", `${p.done}/${p.total} done, ${p.open.length} open`);
    }
    out.push({ who, sent: r.ok, error: r.error || null });
  }

  if (!preview) await supabaseAdmin.from("app_settings").upsert({ key: "todo_remind_sent", value: JSON.stringify(sent), updated_at: new Date().toISOString() }, { onConflict: "key" });
  return res.json({ ok: true, hour, weekday, results: out });
}
