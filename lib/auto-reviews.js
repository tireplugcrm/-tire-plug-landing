/**
 * Automatic review-request loop. Once a day, ask recent customers (who haven't
 * been asked yet) for a Google review — SMS to opted-in customers, email to
 * those with an address. Stamps review_requested_at so nobody is asked twice.
 * Gated by the app_settings 'auto_reviews' flag (owner toggles it in the Reviews tab).
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { sendSms } from "./sms.js";
import { fetchAllCustomers } from "./customers-data.js";

async function getSetting(k) { const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", k).single(); return data ? data.value : ""; }
function daysAgoYmd(days) { const d = new Date(); d.setDate(d.getDate() - days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const first = (n) => (n || "").trim().split(/\s+/)[0] || "there";

async function sendEmail(to, subject, body) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM;
  if (!key || !from) return false;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${body.replace(/\n/g, "<br>")}<hr style="border:none;border-top:1px solid #eee;margin:20px 0"><p style="color:#888;font-size:12px">The Tire Plug · Los Angeles · Reply STOP or unsubscribe to opt out.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject, html, reply_to: process.env.RESEND_REPLY_TO || undefined }) });
    return r.ok;
  } catch (e) { return false; }
}

export async function runAutoReviewRequests({ days = 45, max = 40 } = {}) {
  if ((await getSetting("auto_reviews")) !== "on") return { sent: 0, candidates: 0, reason: "auto-reviews disabled" };
  const reviewUrl = await getSetting("google_review_url");
  if (!reviewUrl) return { sent: 0, candidates: 0, reason: "no Google review link set" };

  const since = daysAgoYmd(days);
  const all = await fetchAllCustomers("id,name,phone,email,sms_opt_in,last_visit,review_requested_at");
  const pool = all
    .filter((c) => c.last_visit && c.last_visit >= since && !c.review_requested_at && ((c.sms_opt_in && c.phone) || c.email))
    .slice(0, max);

  let sent = 0; const ids = [];
  for (const c of pool) {
    const name = first(c.name);
    let ok = false;
    if (c.sms_opt_in && c.phone) {
      ok = (await sendSms({ to: c.phone, body: `Hi ${name}, thanks for choosing The Tire Plug! If we did right by you, mind leaving a quick review? ${reviewUrl} Reply STOP to opt out.` })).ok;
    } else if (c.email) {
      ok = await sendEmail(c.email, "How did we do at The Tire Plug?", `Hi ${name},\n\nThanks for choosing The Tire Plug! If we did right by you, we'd really appreciate a quick Google review — it helps a lot:\n${reviewUrl}\n\nThank you!\nThe Tire Plug`);
    }
    if (ok) { sent += 1; ids.push(c.id); }
  }
  if (ids.length) await supabaseAdmin.from("customers").update({ review_requested_at: new Date().toISOString() }).in("id", ids);
  if (sent) await supabaseAdmin.from("customer_campaigns").insert({ segment: "auto-review", channel: "mixed", body: "Automated review request", recipients: pool.length, sent });
  return { sent, candidates: pool.length };
}
