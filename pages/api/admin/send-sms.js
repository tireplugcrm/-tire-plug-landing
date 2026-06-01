/**
 * Send an SMS to a lead via Twilio (password gated), and log it to the
 * conversation thread. Used for plain texts and for "text this quote".
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10 } from "../../../lib/phone.js";
import { sendSms } from "../../../lib/sms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, lead_id, body } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });
  if (!body || !body.trim()) return res.status(400).json({ error: "Message is empty." });

  // Look up the lead's phone
  const { data: lead } = await supabaseAdmin.from("leads").select("phone").eq("id", lead_id).single();
  const result = await sendSms({ to: lead?.phone, body });
  if (!result.ok) return res.status(502).json({ error: result.error });

  // Log to the conversation
  await supabaseAdmin.from("lead_messages").insert({
    lead_id,
    direction: "outbound",
    phone: digits10(lead?.phone),
    body,
    twilio_sid: result.sid,
    status: result.status,
    read: true,
  });

  return res.status(200).json({ success: true });
}
