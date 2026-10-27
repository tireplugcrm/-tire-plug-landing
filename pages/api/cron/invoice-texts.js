/**
 * Invoice check-in texts (lib/invoices.js). Mon–Sat at 10:00 AM and 4:30 PM shop time, texts
 * everyone in app_settings.invoice_text_to the /invoices link.
 *
 * Supabase pg_cron calls it (jobs invoice-texts-am / -pm, in UTC) at both the summer and winter
 * UTC times, because Vercel Hobby crons only run once a day at a loose time. The handler only acts
 * at 10:00–10:29 or 16:30–16:59 LA time, and stamps am_texted_at / pm_texted_at so a re-run never
 * double-texts.
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>" or the random key in app_settings 'invoice_cron_key'
 * (what pg_cron sends). Admins send a text right away with POST /api/admin/invoices { action: "text-now" }.
 */
import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { sendSms } from "../../../lib/sms.js";
import { setting, shopClock, shopDay, uploadLink } from "../../../lib/invoices.js";

const dayName = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export async function sendInvoiceText(slot, { force = false } = {}) {
  const day = shopDay(0);
  // Until phones are set in Admin → Invoices, the owner's alert phone gets it.
  const to = ((await setting("invoice_text_to")) || process.env.ADMIN_ALERT_PHONE || "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  if (!to.length) return { skipped: "No phone numbers set (Admin → Invoices)." };

  const col = slot === "am" ? "am_texted_at" : "pm_texted_at";
  const { data: today } = await supabaseAdmin.from("invoice_days").select("*").eq("day", day).maybeSingle();
  if (today?.[col] && !force) return { skipped: "Already texted." };
  const { count: uploads } = await supabaseAdmin.from("invoice_uploads").select("id", { count: "exact", head: true }).eq("day", day);

  // Earlier shop days this week that nobody answered (Sundays are skipped).
  const back = Array.from({ length: 6 }, (_, i) => shopDay(i + 1)).filter((d) => new Date(`${d}T12:00:00`).getDay() !== 0);
  const { data: prev } = await supabaseAdmin.from("invoice_days").select("day, status").in("day", back);
  const answered = new Set((prev || []).filter((r) => r.status).map((r) => r.day));
  const missing = back.filter((d) => !answered.has(d) && d >= "2026-10-27"); // check-ins started Oct 27

  const link = await uploadLink();
  let body = slot === "am"
    ? "Tire Plug: any tire deliveries this morning? Snap each invoice here"
    : uploads
      ? `Tire Plug: ${uploads} invoice photo${uploads === 1 ? "" : "s"} in for today. Any other deliveries? Add them here`
      : "Tire Plug: no delivery invoices uploaded today yet. Upload them, or tap No deliveries";
  body += `: ${link}`;
  if (missing.length) body += `\nStill open: ${missing.map(dayName).join(", ")} (pick it on the page).`;

  const results = [];
  for (const phone of to) results.push({ phone, ...(await sendSms({ to: phone, body })) });
  // A manual "Send the text now" (force) never counts as the scheduled 10 AM / 4:30 PM text.
  if (!force && results.some((r) => r.ok)) await supabaseAdmin.from("invoice_days").upsert({ day, [col]: new Date().toISOString() });
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => `${r.phone}: ${r.error}`), body };
}

const same = (a, b) => !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function authorized(req) {
  const got = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  if (same(got, process.env.CRON_SECRET || "")) return true;
  const key = await setting("invoice_cron_key");
  return key.length >= 32 && same(got, key);
}

export default async function handler(req, res) {
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });
  if (!(await authorized(req))) return res.status(401).json({ error: "Unauthorized" });

  const { hour, minute, weekday } = shopClock();
  if (weekday === 0) return res.json({ skipped: "Sunday" });
  const slot = hour === 10 && minute < 30 ? "am" : hour === 16 && minute >= 30 ? "pm" : null;
  if (!slot) return res.json({ skipped: `Not a check-in time (${hour}:${String(minute).padStart(2, "0")} LA).` });
  return res.json(await sendInvoiceText(slot));
}
