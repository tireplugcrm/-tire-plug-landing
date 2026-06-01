/**
 * Auto follow-up engine for unanswered quotes.
 * When a quote is sent, schedule the FOLLOWUPS nudges via Twilio (Twilio holds
 * and sends them later). The moment the customer replies, cancel any that
 * haven't gone out yet. Scheduled nudges are tracked as lead_messages rows
 * with status 'scheduled' so we can cancel and hide them from the thread.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { scheduleSms, cancelScheduledSms } from "./sms.js";
import { digits10 } from "./phone.js";
import { FOLLOWUPS } from "./shop-facts.js";

function firstName(name) { return (name || "").trim().split(/\s+/)[0] || "there"; }

/** Cancel any still-scheduled follow-ups for a lead (e.g. when they reply). */
export async function cancelFollowups(leadId) {
  if (!supabaseAdmin || !leadId) return;
  const { data } = await supabaseAdmin
    .from("lead_messages").select("id, twilio_sid")
    .eq("lead_id", leadId).eq("status", "scheduled");
  for (const m of data || []) {
    if (m.twilio_sid) await cancelScheduledSms(m.twilio_sid);
    await supabaseAdmin.from("lead_messages").update({ status: "canceled" }).eq("id", m.id);
  }
}

/** Schedule the follow-up sequence for a lead (cancels any prior one first). */
export async function armFollowups({ leadId, phone, name }) {
  if (!supabaseAdmin || !leadId || !phone) return;
  if (!process.env.TWILIO_MESSAGING_SERVICE_SID) return; // scheduling not set up yet

  await cancelFollowups(leadId); // reset any prior sequence

  const fn = firstName(name);
  for (const f of FOLLOWUPS) {
    const sendAt = new Date(Date.now() + f.minutes * 60000).toISOString();
    const body = f.text.replace(/\{name\}/g, fn);
    const r = await scheduleSms({ to: phone, body, sendAt });
    if (r.ok) {
      await supabaseAdmin.from("lead_messages").insert({
        lead_id: leadId,
        direction: "outbound",
        phone: digits10(phone),
        body,
        twilio_sid: r.sid,
        status: "scheduled",
        read: true,
      });
    }
  }
}
