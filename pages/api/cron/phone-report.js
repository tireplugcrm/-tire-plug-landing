/**
 * Jarvis daily phone report: every evening (Vercel Cron, 03:30 UTC = 7:30 PM LA in winter, 8:30 PM in
 * summer) the owner gets a text with today's phone AI (Mary) numbers from phone_calls (lib/phone-calls.js):
 * calls, bookings, $ booked, leads, alignment adds, quality, why sales were lost, sizes to stock, used-tire asks.
 * No calls today: no text. ?day=YYYY-MM-DD reports another LA day; ?dry=1 returns the text without sending.
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>" (what Vercel Cron sends).
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { report } from "../../../lib/phone-calls.js";
import { notify } from "../../../lib/agent.js";

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const laDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
// Midnight in Los Angeles for a YYYY-MM-DD day, as an ISO instant.
function laMidnight(ymd) {
  const guess = new Date(`${ymd}T08:00:00Z`);
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(guess));
  return new Date(guess.getTime() - h * 3600000).toISOString();
}
const top = (list, n = 3) => list.slice(0, n).map((x) => `${x.name} (${x.n})`).join(", ");

export function reportText(day, r) {
  const lines = [
    `Phone report ${day}: Mary answered ${r.calls} call${r.calls === 1 ? "" : "s"} (${r.minutes} min).`,
    `Booked ${r.booked}${r.bookRate != null ? ` (${r.bookRate}% of ${r.salesCalls} sales calls)` : ""}, $${Math.round(r.bookedValue).toLocaleString("en-US")} in tires. Leads for reps: ${r.leads}.${r.lost ? ` Lost with nothing saved: ${r.lost}.` : ""}`,
    r.alignment.of ? `Alignment offered on ${r.alignment.offered}/${r.alignment.of} tire calls, ${r.alignment.accepted} added.` : null,
    r.quality != null ? `Sales quality ${r.quality}/100.${(() => { const weak = Object.values(r.checks).filter((c) => c.rate != null && c.rate < 80).map((c) => c.label); return weak.length ? ` Weak: ${weak.join(", ")}.` : ""; })()}` : null,
    r.lostReasons.length ? `Why no booking: ${top(r.lostReasons)}.` : null,
    r.quotedNotInStock.length ? `Asked but not on the shelf: ${top(r.quotedNotInStock, 4)}.` : null,
    r.used.requests ? `Used-tire asks: ${r.used.requests}${r.used.sizes.length ? ` (${top(r.used.sizes)})` : ""}.` : null,
    r.transfers ? `Transferred to a person: ${r.transfers}.` : null,
    `Details: tireplugla.com/admin > Phone.`,
  ];
  return lines.filter(Boolean).join("\n");
}

export default async function handler(req, res) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || !same(got, process.env.CRON_SECRET)) return res.status(401).end();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(req.query.day || "") ? req.query.day : laDay();
  const next = new Date(new Date(`${day}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin.from("phone_calls").select("*").eq("test", false).gte("started_at", laMidnight(day)).lt("started_at", laMidnight(next));
  if (error) return res.status(500).json({ error: error.message });
  if (!data?.length) return res.status(200).json({ skipped: "no calls" });
  const text = reportText(day, report(data));
  if (req.query.dry) return res.status(200).json({ text });
  await notify("phone-report", text);
  return res.status(200).json({ ok: true, text });
}
