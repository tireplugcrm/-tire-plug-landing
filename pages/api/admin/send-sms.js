/**
 * Send an SMS to a lead via Twilio (password gated), and log it to the
 * conversation thread. Used for plain texts and for "text this quote".
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10, toE164 } from "../../../lib/phone.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { password, lead_id, body } = req.body || {};
  if (!process.env.CAREERS_ADMIN_PASSWORD || password !== process.env.CAREERS_ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });
  if (!body || !body.trim()) return res.status(400).json({ error: "Message is empty." });

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    return res.status(500).json({ error: "Texting isn't set up yet (Twilio keys missing)." });
  }

  // Look up the lead's phone
  const { data: lead } = await supabaseAdmin.from("leads").select("phone").eq("id", lead_id).single();
  const to = toE164(lead?.phone);
  if (!to) return res.status(400).json({ error: "This lead has no valid phone number to text." });

  // Send via Twilio REST API
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  let twilioSid = null;
  let status = "sent";
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: data.message || "Text failed to send." });
    }
    twilioSid = data.sid;
    status = data.status || "sent";
  } catch (err) {
    return res.status(502).json({ error: "Could not reach Twilio." });
  }

  // Log to the conversation
  await supabaseAdmin.from("lead_messages").insert({
    lead_id,
    direction: "outbound",
    phone: digits10(lead?.phone),
    body,
    twilio_sid: twilioSid,
    status,
    read: true,
  });

  return res.status(200).json({ success: true });
}
