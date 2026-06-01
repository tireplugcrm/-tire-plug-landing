/**
 * Inbound SMS webhook (Twilio). Saves the text to the conversation and links
 * it to the matching lead by phone number.
 *
 * In Twilio: Phone Numbers → your number → Messaging → "A MESSAGE COMES IN"
 * → Webhook (HTTP POST):
 *    https://tireplugla.com/api/admin/sms-inbound?token=YOUR_SECRET
 * and set TWILIO_INBOUND_SECRET to that same secret.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10 } from "../../../lib/phone.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.TWILIO_INBOUND_SECRET;
  if (!secret || req.query.token !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const b = req.body || {};
  const from = b.From || b.from;
  const body = b.Body || b.body || "";
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
        twilio_sid: b.MessageSid || b.SmsSid || null,
        status: "received",
        read: false,
      });
    } catch (err) {
      console.error("Inbound SMS save error:", err);
    }
  }

  // Empty TwiML so Twilio doesn't auto-reply.
  res.setHeader("Content-Type", "text/xml");
  return res.status(200).send("<Response></Response>");
}
