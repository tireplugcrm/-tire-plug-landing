/**
 * Inbound SMS webhook (GoHighLevel or Twilio). Saves the text to the conversation and links
 * it to the matching lead by phone number.
 *
 * In GHL: Automation → new workflow, trigger "Customer Replied" (Reply channel: SMS)
 * → action "Webhook", Method POST, URL:
 *    https://tireplugla.com/api/admin/sms-inbound?token=YOUR_SECRET
 * GHL posts the contact (phone) and the reply (message.body). Optional Custom Data
 * "phone" / "body" override them. Set GHL_INBOUND_SECRET to the same secret.
 *
 * In Twilio: Phone Numbers → your number → Messaging → "A MESSAGE COMES IN"
 * → Webhook (HTTP POST):
 *    https://tireplugla.com/api/admin/sms-inbound?token=YOUR_SECRET
 * and set TWILIO_INBOUND_SECRET to that same secret.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10 } from "../../../lib/phone.js";
import { cancelFollowups } from "../../../lib/followups.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // GHL_INBOUND_SECRET for the GHL workflow, TWILIO_INBOUND_SECRET for Twilio's webhook.
  const secrets = [process.env.GHL_INBOUND_SECRET, process.env.TWILIO_INBOUND_SECRET].filter(Boolean);
  if (!req.query.token || !secrets.includes(req.query.token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const b = req.body || {};
  const cd = b.customData || {};
  const isGhl = !b.From && !b.MessageSid;
  const from = b.From || cd.phone || b.phone || b.contact?.phone || b.from;
  const body = b.Body || cd.body || b.message?.body || (typeof b.message === "string" ? b.message : "") || b.body || "";
  const phone = digits10(from);

  if (supabaseAdmin && phone) {
    try {
      // Link to the most recent lead whose phone matches (by last 10 digits).
      const { data: candidates } = await supabaseAdmin
        .from("leads")
        .select("id, phone")
        .order("created_at", { ascending: false })
        .limit(500);
      const hit = (candidates || []).find((l) => digits10(l.phone) === phone);
      const leadId = hit ? hit.id : null;

      await supabaseAdmin.from("lead_messages").insert({
        lead_id: leadId,
        direction: "inbound",
        phone,
        body,
        twilio_sid: b.MessageSid || b.SmsSid || (b.message?.id ? `ghl:${b.message.id}` : null),
        status: "received",
        read: false,
      });

      // Customer replied — stamp the reply (pulls them out of the cold path) + cancel nudges.
      if (leadId) {
        await supabaseAdmin.from("leads").update({ last_reply_at: new Date().toISOString() }).eq("id", leadId);
        await cancelFollowups(leadId);
      }
    } catch (err) {
      console.error("Inbound SMS save error:", err);
    }
  }

  if (isGhl) return res.status(200).json({ ok: true });

  // Empty TwiML so Twilio doesn't auto-reply.
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<Response></Response>");
}
