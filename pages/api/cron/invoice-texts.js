/**
 * Invoice check-in texts (lib/invoices.js). Mon–Sat at 10:00 AM and 4:30 PM shop time, texts
 * everyone in app_settings.invoice_text_to the /invoices link.
 *
 * Vercel Cron runs in UTC, so vercel.json fires this every half hour around both the summer and
 * winter UTC times; the handler only acts at 10:00–10:29 or 16:30–16:59 LA time, and stamps
 * am_texted_at / pm_texted_at so a re-run never double-texts.
 *
 * Auth: "Authorization: Bearer <CRON_SECRET>" (Vercel Cron), or an admin forcing a slot:
 * POST /api/admin/invoices { action: "text-now" } uses sendInvoiceText directly.
 */
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
  const missing = back.filter((d) => !answered.has(d) && d >= "2026-10-28"); // check-ins started Oct 28

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
  if (results.some((r) => r.ok)) await supabaseAdmin.from("invoice_days").upsert({ day, [col]: new Date().toISOString() });
  return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).map((r) => `${r.phone}: ${r.error}`), body };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || "") !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { hour, minute, weekday } = shopClock();
  if (weekday === 0) return res.json({ skipped: "Sunday" });
  const slot = hour === 10 && minute < 30 ? "am" : hour === 16 && minute >= 30 ? "pm" : null;
  if (!slot) return res.json({ skipped: `Not a check-in time (${hour}:${String(minute).padStart(2, "0")} LA).` });
  return res.json(await sendInvoiceText(slot));
}
