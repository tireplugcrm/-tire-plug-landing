/**
 * Send an SMS to a lead via Twilio (password gated), and log it to the
 * conversation thread. Used for plain texts and for "text this quote".
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10 } from "../../../lib/phone.js";
import { sendSms } from "../../../lib/sms.js";
import { armFollowups } from "../../../lib/followups.js";
import { requireAdmin } from "../../../lib/adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  const { lead_id, body, startFollowups, test, to } = req.body || {};

  // Admin-only test text to any number (no lead, nothing logged): checks the provider setup.
  if (test) {
    const r = await sendSms({ to, body: body || "Test from the Tire Plug admin: texting works. Reply to check replies reach the admin." });
    return res.status(r.ok ? 200 : 502).json(r);
  }
  if (!supabaseAdmin || !lead_id) return res.status(400).json({ error: "Missing config or lead." });
  if (!body || !body.trim()) return res.status(400).json({ error: "Message is empty." });

  // Look up the lead's phone + name
  const { data: lead } = await supabaseAdmin.from("leads").select("phone, name").eq("id", lead_id).single();
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

  // A person replied: the Front Desk agent stops nagging about this lead.
  await supabaseAdmin.from("leads").update({ first_response_at: new Date().toISOString() }).eq("id", lead_id).is("first_response_at", null);

  // If this was the quote, arm the auto follow-up sequence (non-blocking).
  if (startFollowups) {
    try { await armFollowups({ leadId: lead_id, phone: lead?.phone, name: lead?.name }); }
    catch (e) { console.error("arm follow-ups error:", e); }
  }

  return res.status(200).json({ success: true });
}
