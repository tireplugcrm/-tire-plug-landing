/**
 * Business outreach email, shared by Admin > Businesses (pages/api/admin/prospects.js) and the
 * Jarvis outreach agent (pages/api/agent.js "outreach-plan" / "outreach-send"). Server-only.
 *
 * Guardrails (keep the domain out of spam folders and inside CAN-SPAM):
 *   - a daily cap (OUTREACH_DAILY_LIMIT, default 40) across all outreach sends, ramped up over the
 *     first three weeks after the first outreach send so the sending domain warms up
 *   - step 1 only to businesses never emailed; step 2 (follow-up) only 4+ days after step 1
 *   - nobody who replied, unsubscribed, bounced, said no, or is already a customer
 *   - every email: real sender, labeled as an advertisement, shop address, a one-click unsubscribe
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { renderLetter, sendBatch, suppressedSet, unsubPageUrl, personalize, textVersion, OUTREACH_FROM, SITE } from "./email.js";

const DAILY_LIMIT = Number(process.env.OUTREACH_DAILY_LIMIT) || 40;
export const FOLLOWUP_DAYS = 4;
export const DONE = new Set(["replied", "customer", "not_interested", "unsubscribed", "bounced", "needs_email", "no_email"]);
const WHY = "This is an advertisement from The Tire Plug. You're getting it because your business is listed publicly near our shop in Los Angeles. We email a business at most twice, and if you unsubscribe you won't hear from us again.";
// The button under the letter: the fleet catalog, or the commercial (truck) tire page.
const CTAS = { fleet: { label: "See fleet tire prices", path: "/fleet" }, commercial: { label: "See truck tire prices", path: "/commercial-tires" } };
// Tire photos beside the logo: a car, a van and a pickup tire we sell (email-safe copies).
const HEADER_TIRES = [
  { img: "/images/email/tires/landspider-citytraxx-g-p.jpg", alt: "Landspider Citytraxx G/P" },
  { img: "/images/email/tires/gt-radial-maxmiler-pro.jpg", alt: "GT Radial Maxmiler Pro" },
  { img: "/images/email/tires/goodyear-wrangler-territory-ht.jpg", alt: "Goodyear Wrangler Territory HT" },
];

// Warm-up: 10/day the first week of outreach, then 20, then 30, then the full limit.
export async function dailyLimit() {
  const { data } = await supabaseAdmin.from("email_campaigns").select("created_at").eq("kind", "outreach").order("created_at", { ascending: true }).limit(1);
  const first = data?.[0]?.created_at;
  const week = first ? Math.floor((Date.now() - new Date(first).getTime()) / (7 * 864e5)) : 0;
  return Math.min(DAILY_LIMIT, [10, 20, 30][week] ?? DAILY_LIMIT);
}

export const startOfTodayLA = () => {
  const now = new Date();
  const la = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return new Date(now.getTime() - (la.getHours() * 3600 + la.getMinutes() * 60 + la.getSeconds()) * 1000);
};

export async function sentToday() {
  const { count } = await supabaseAdmin.from("business_prospects").select("id", { count: "exact", head: true }).gte("last_emailed_at", startOfTodayLA().toISOString());
  return count || 0;
}

export function letter({ message, signer, to, name, business, button }) {
  const unsubUrl = unsubPageUrl(to);
  const body = personalize(message, { name, business });
  const c = CTAS[button] || CTAS.fleet;
  const cta = { label: c.label, href: `${SITE}${c.path}` };
  return { html: renderLetter({ message: body, signer, unsubUrl, why: WHY, cta, tires: HEADER_TIRES }), text: textVersion(`${body}\n\n${cta.label}: ${cta.href}`, unsubUrl, WHY) };
}

// Can this business get this step today? (Ignores the daily cap.)
export function eligibleFor(step, p, blocked, now = Date.now()) {
  if (!p.email || blocked.has(p.email.toLowerCase()) || DONE.has(p.status)) return false;
  if (step === 1) return p.touches === 0;
  return p.touches === 1 && !!p.last_emailed_at && new Date(p.last_emailed_at).getTime() <= now - FOLLOWUP_DAYS * 864e5;
}

/**
 * Send one step to the given businesses, up to what's left of today's cap.
 * -> { status, body } where body is what the API returns ({ sent, failed, skipped, error, remainingToday } or { error }).
 */
export async function sendOutreach({ ids, step: s, subject, message, signer, button, createdBy }) {
  const step = Number(s) === 2 ? 2 : 1;
  if (!Array.isArray(ids) || !ids.length) return { status: 400, body: { error: "Pick at least one business." } };
  if (!subject || !message) return { status: 400, body: { error: "Subject and message are required." } };

  const limit = await dailyLimit();
  const room = Math.max(0, limit - (await sentToday()));
  if (!room) return { status: 429, body: { error: `Daily limit reached (${limit}/day while the sending domain warms up keeps your email out of spam). Send more tomorrow.` } };

  const { data: rows } = await supabaseAdmin.from("business_prospects").select("*").in("id", ids);
  const blocked = await suppressedSet();
  const batch = (rows || []).filter((p) => eligibleFor(step, p, blocked)).slice(0, room);
  if (!batch.length) return { status: 400, body: { error: step === 1 ? "None of those can get an intro (already emailed, replied, or unsubscribed)." : `None of those are ready for a follow-up (needs an intro ${FOLLOWUP_DAYS}+ days ago and no reply).` } };

  const { data: camp } = await supabaseAdmin.from("email_campaigns").insert({
    kind: "outreach", subject, body: message, audience: `businesses (step ${step})`, status: "sending", send_at: new Date().toISOString(), created_by: createdBy,
  }).select().single();

  const msgs = batch.map((p) => ({
    to: p.email, from: OUTREACH_FROM,
    subject: personalize(subject, { name: p.contact_name, business: p.business_name }),
    ...letter({ message, signer, to: p.email, name: p.contact_name, business: p.business_name, button }),
    tags: { campaign: camp?.id, kind: "outreach" },
  }));
  const out = await sendBatch(msgs);
  if (out.sent) {
    await supabaseAdmin.from("business_prospects").update({ status: "emailed", touches: step, last_emailed_at: new Date().toISOString() }).in("id", batch.map((p) => p.id));
  }
  if (camp) await supabaseAdmin.from("email_campaigns").update({ status: out.sent ? "sent" : "failed", recipient_count: batch.length, sent_count: out.sent, error_count: out.failed }).eq("id", camp.id);
  return { status: 200, body: { sent: out.sent, failed: out.failed, skipped: ids.length - batch.length, error: out.error, remainingToday: room - out.sent, sentIds: out.sent ? batch.map((p) => p.id) : [] } };
}
