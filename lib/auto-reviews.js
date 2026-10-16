/**
 * Automatic review-request loop. Once a day, ask recent customers (who haven't
 * been asked yet) for a Google review — SMS to opted-in customers, email to
 * those with an address. Stamps review_requested_at so nobody is asked twice.
 * Gated by the app_settings 'auto_reviews' flag (owner toggles it in the Reviews tab).
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { sendSms } from "./sms.js";
import { fetchAllCustomers } from "./customers-data.js";
import { renderPromo, sendOne, suppressedSet, unsubPageUrl, textVersion } from "./email.js";

async function getSetting(k) { const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", k).single(); return data ? data.value : ""; }
function daysAgoYmd(days) { const d = new Date(); d.setDate(d.getDate() - days); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
const first = (n) => (n || "").trim().split(/\s+/)[0] || "there";

// Branded email with an unsubscribe link; skips anyone who unsubscribed or bounced.
let blocked = null;
async function sendEmail(to, subject, body) {
  if (!process.env.RESEND_API_KEY) return false;
  const email = String(to).trim().toLowerCase();
  blocked = blocked || (await suppressedSet());
  if (blocked.has(email)) return false;
  const unsubUrl = unsubPageUrl(email);
  const out = await sendOne({ to: email, subject, html: renderPromo({ subject, headline: "How did we do?", message: body, unsubUrl }), text: textVersion(body, unsubUrl), tags: { kind: "review_request" } });
  return out.sent > 0;
}

export async function runAutoReviewRequests({ days = 45, max = 40 } = {}) {
  blocked = null; // reload the unsubscribe list each run
  if ((await getSetting("auto_reviews")) !== "on") return { sent: 0, candidates: 0, reason: "auto-reviews disabled" };
  const revOlympic = (await getSetting("review_url_olympic")) || (await getSetting("google_review_url"));
  const reviewLinks = revOlympic ? `Olympic: ${revOlympic}` : "";
  if (!reviewLinks) return { sent: 0, candidates: 0, reason: "no Google review link set" };

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
      ok = (await sendSms({ to: c.phone, body: `Hi ${name}, thanks for choosing The Tire Plug! If we did right by you, mind leaving a quick review? ${reviewLinks} Reply STOP to opt out.` })).ok;
    } else if (c.email) {
      ok = await sendEmail(c.email, "How did we do at The Tire Plug?", `Hi ${name},\n\nThanks for choosing The Tire Plug! If we did right by you, we'd really appreciate a quick Google review — it helps a lot:\n${reviewLinks}\n\nThank you!\nThe Tire Plug`);
    }
    if (ok) { sent += 1; ids.push(c.id); }
  }
  if (ids.length) await supabaseAdmin.from("customers").update({ review_requested_at: new Date().toISOString() }).in("id", ids);
  if (sent) await supabaseAdmin.from("customer_campaigns").insert({ segment: "auto-review", channel: "mixed", body: "Automated review request", recipients: pool.length, sent });
  return { sent, candidates: pool.length };
}
