/**
 * Lexi's Commission Tracker clock (lib/commission.js). Supabase pg_cron job "commission-tick" calls
 * it at both summer and winter UTC hours; it only acts in the right LA hour, Mon–Sat:
 *   12 PM  text Lexi to report her ROs so far
 *    5 PM  text Lexi to report the rest of the day
 *    7 PM  re-try Tekmetric matches, email the recap (today / this week / this month), then text
 *          Lexi that it's in her inbox. ?force=recap&test=1 marks the email as a test;
 *          &notext=1 skips the text (a resend).
 *          Saturday's says "Week recap", the last day of the month says "Month recap".
 * commission_days stamps each one so a re-run never doubles. ?force=midday|eod|recap sends now;
 * ?force=welcome sends Lexi her link with a how-to.
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>" or app_settings 'commission_cron_key' (what pg_cron sends).
 */
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { sendSms } from "../../../lib/sms.js";
import { renderNotice, sendOne } from "../../../lib/email.js";
import { shopClock } from "../../../lib/invoices.js";
import { matchReport, rate, reportLink, setting, shopDay, totals } from "../../../lib/commission.js";

const $ = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const list = (s) => String(s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

async function text(slot) {
  const to = list(await setting("commission_text_to"));
  if (!to.length) return { skipped: "No phone set (app_settings commission_text_to)." };
  const { today } = await totals();
  const link = await reportLink();
  const body = slot === "welcome"
    ? `Hi Lexi! This is your commission tracker from The Tire Plug. Every time you sell an RO, open this link, tap Start, and enter the RO # and the name on the RO. Save it to your home screen: ${link}`
    : slot === "emailed"
    ? "Hi Lexi! We just emailed you today's commission report from The Tire Plug. Check your inbox (and spam). Questions? Call or text us at (562) 250-3737."
    : slot === "midday"
    ? `Hi Lexi! Midday check-in from The Tire Plug: report the ROs you've sold so far (${today.count} in today): ${link}`
    : `Hi Lexi! End of day: make sure every RO you sold today is in (${today.count} so far) so it counts toward your commission: ${link}`;
  const results = [];
  for (const phone of to) results.push({ phone, ...(await sendSms({ to: phone, body })) });
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => `${r.phone}: ${r.error}`) };
}

async function recap({ test = false } = {}) {
  const day = shopDay(0);
  const { data: open } = await supabaseAdmin.from("commission_reports").select("*").neq("status", "matched").gte("day", `${day.slice(0, 7)}-01`);
  for (const row of open || []) await matchReport(row);

  const t = await totals(day);
  const pct = await rate();
  const d = new Date(`${day}T12:00:00Z`);
  const lastOfMonth = new Date(d.getTime() + 864e5).getUTCDate() === 1;
  const kind = lastOfMonth ? "Month" : d.getUTCDay() === 6 ? "Week" : "Daily";
  const amt = (s) => (pct == null ? `${s.count} RO${s.count === 1 ? "" : "s"}` : $(s.commission));

  const roRows = t.todayRows.map((r) => [
    `RO #${r.ro_number}`,
    `${r.ro_name} · ${r.status === "matched"
      ? `${$(r.labor_total)} labor${r.commission != null ? ` · ${$(r.commission)} commission` : ""} · ${(r.lines || []).map((l) => `${l.qty}× ${l.name}`).join(", ")}`
      : r.status === "no-match" ? "not found in Tekmetric, check the RO #" : "waiting on the Tekmetric match"}${r.notes && r.status === "matched" ? ` ⚑ ${r.notes}` : ""}`,
  ]);
  const flagged = t.todayRows.filter((r) => r.notes).length;

  const message = [
    `${amt(t.today)} in commission today`,
    `${amt(t.week)} in commission this week`,
    `${amt(t.month)} in commission this month`,
    test ? "This is a test of the daily recap email." : "",
    pct == null ? "Commission rate isn't set yet, so these are RO counts." : `Commission is ${Math.round(pct * 1000) / 10}% of labor on your ROs.`,
    flagged ? `${flagged} RO${flagged === 1 ? " needs" : "s need"} a check (marked ⚑ below).` : "",
    t.month.pending ? `${t.month.pending} RO${t.month.pending === 1 ? " is" : "s are"} still waiting on the Tekmetric match and will count once matched.` : "",
  ].filter(Boolean).join("\n\n");

  const html = renderNotice({
    headline: `Lexi's ${kind} Commission Recap`,
    message,
    details: roRows.length ? roRows : [["Today", "No ROs reported"]],
    preheader: `${amt(t.today)} today · ${amt(t.week)} this week · ${amt(t.month)} this month`,
  });
  const to = list(await setting("commission_email_to"));
  let sent = 0;
  for (const addr of to) sent += (await sendOne({ to: addr, subject: `${test ? "Test: " : ""}Lexi's ${kind} Commission Recap · ${amt(t.today)} today`, html, text: message, transactional: true })).sent;
  return { sent, kind, today: t.today, week: t.week, month: t.month };
}

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function authorized(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (same(got, process.env.CRON_SECRET || "")) return true;
  const key = await setting("commission_cron_key");
  return key.length >= 32 && same(got, key);
}

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!(await authorized(req))) return res.status(401).json({ error: "Unauthorized" });

  const force = ["welcome", "emailed", "midday", "eod", "recap"].includes(req.query.force) ? req.query.force : null;
  const { hour, weekday } = shopClock();
  const slot = force || (weekday === 0 ? null : hour === 12 ? "midday" : hour === 17 ? "eod" : hour === 19 ? "recap" : null);
  if (!slot) return res.json({ skipped: `Nothing due at ${hour}:00 LA.` });

  const day = shopDay(0);
  const col = { welcome: "midday_texted_at", emailed: "recap_sent_at", midday: "midday_texted_at", eod: "eod_texted_at", recap: "recap_sent_at" }[slot];
  const { data: stamp } = await supabaseAdmin.from("commission_days").select("*").eq("day", day).maybeSingle();
  if (stamp?.[col] && !force) return res.json({ skipped: "Already done today." });

  let out;
  if (slot === "recap") {
    // After the email goes out, text Lexi that it's in her inbox.
    out = await recap({ test: req.query.test === "1" });
    if (out.sent && req.query.notext !== "1") out.text = await text("emailed");
  } else out = await text(slot);
  if (!force && out.sent) await supabaseAdmin.from("commission_days").upsert({ day, [col]: new Date().toISOString() });
  return res.json({ slot, ...out });
}
