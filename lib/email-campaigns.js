/**
 * Email blasts to leads / subscribers: who gets one, and the actual send.
 * Used by the dashboard (send now) and the daily cron (scheduled sends).
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { renderPromo, sendBatch, suppressedSet, unsubPageUrl, personalize, textVersion } from "./email.js";

const valid = (e) => /\S+@\S+\.\S+/.test(e || "");

// [{ email, name }] for an audience, minus anyone suppressed. Deduped by address.
export async function blastRecipients(audience) {
  const byEmail = new Map();
  const add = (rows) => (rows || []).forEach((r) => {
    const e = (r.email || "").trim().toLowerCase();
    if (valid(e) && !byEmail.has(e)) byEmail.set(e, { email: e, name: r.name || "" });
  });
  if (audience === "subscribers" || audience === "both") {
    const { data } = await supabaseAdmin.from("subscribers").select("email,name").eq("status", "active");
    add(data);
  }
  if (audience === "leads" || audience === "both") {
    const { data } = await supabaseAdmin.from("leads").select("email,name").neq("status", "dead");
    add(data);
  }
  const blocked = await suppressedSet();
  return [...byEmail.values()].filter((r) => !blocked.has(r.email));
}

const WHY = "You're getting this because you signed up or requested a quote at tireplugla.com.";

// One personalized email for one person.
export function blastEmail({ subject, headline, message, tires }, to, name) {
  const unsubUrl = unsubPageUrl(to);
  const body = personalize(message, { name });
  return { html: renderPromo({ subject, headline, message: body, tires, unsubUrl, why: WHY }), text: textVersion(body, unsubUrl) };
}

// Send a logged campaign row now; updates its status and counts.
export async function deliverCampaign(row) {
  await supabaseAdmin.from("email_campaigns").update({ status: "sending" }).eq("id", row.id);
  const recipients = await blastRecipients(row.audience);
  const msgs = recipients.map((r) => ({
    to: r.email, subject: personalize(row.subject, { name: r.name }),
    ...blastEmail({ subject: row.subject, headline: row.headline, message: row.body, tires: row.tire_ids || [] }, r.email, r.name),
    tags: { campaign: row.id, kind: row.kind || "blast" },
  }));
  const out = msgs.length ? await sendBatch(msgs) : { sent: 0, failed: 0 };
  await supabaseAdmin.from("email_campaigns").update({
    status: out.sent ? "sent" : "failed", recipient_count: recipients.length, sent_count: out.sent, error_count: out.failed,
  }).eq("id", row.id);
  return { ...out, total: recipients.length };
}
