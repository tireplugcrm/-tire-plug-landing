/**
 * Inbound SMS webhook (GoHighLevel or Twilio). Saves the text to the conversation and links
 * it to the matching lead by phone number.
 *
 * In GHL: Automation → workflow "Customer Replied" (Reply channel: SMS) → action "Webhook",
 * Method POST, URL: https://tireplugla.com/api/admin/sms-inbound
 * No secret needed: the post is only a nudge. We read the contact's recent inbound texts back
 * from GHL with our own API key and save those, so a forged call can't inject a fake message.
 *
 * In Twilio: Phone Numbers → your number → Messaging → "A MESSAGE COMES IN"
 * → Webhook (HTTP POST):
 *    https://tireplugla.com/api/admin/sms-inbound?token=YOUR_SECRET
 * and set TWILIO_INBOUND_SECRET to that same secret.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { digits10 } from "../../../lib/phone.js";
import { cancelFollowups } from "../../../lib/followups.js";
import { ghlRecentInbound } from "../../../lib/sms.js";

// Only replies from the last day count, so the first nudge doesn't import old history.
const FRESH_MS = 24 * 3600 * 1000;

async function saveInbound({ phone, body, sid, at }) {
  phone = digits10(phone);
  if (!supabaseAdmin || !phone || !body) return false;

  if (sid) {
    const { data: seen } = await supabaseAdmin.from("lead_messages").select("id").eq("twilio_sid", sid).limit(1);
    if (seen && seen.length) return false; // already saved
  }

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
    twilio_sid: sid || null,
    status: "received",
    read: false,
    ...(at ? { created_at: at } : {}), // GHL's time, not when we picked it up
  });

  // Customer replied — stamp the reply (pulls them out of the cold path) + cancel nudges.
  if (leadId) {
    await supabaseAdmin.from("leads").update({ last_reply_at: new Date().toISOString() }).eq("id", leadId);
    await cancelFollowups(leadId);
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const b = req.body || {};

  // Twilio: form post with From/Body, guarded by the shared secret.
  if (b.From || b.MessageSid) {
    const secret = process.env.TWILIO_INBOUND_SECRET;
    if (!secret || req.query.token !== secret) return res.status(401).json({ error: "Unauthorized" });
    try { await saveInbound({ phone: b.From, body: b.Body || "", sid: b.MessageSid || b.SmsSid || null }); }
    catch (err) { console.error("Inbound SMS save error:", err); }
    // Empty TwiML so Twilio doesn't auto-reply.
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send("<Response></Response>");
  }

  // GHL: trust nothing in the post except which contact to look up.
  const contactId = b.contact_id || b.contactId || b.contact?.id;
  if (!contactId) return res.status(400).json({ error: "No contact." });
  const recent = await ghlRecentInbound(contactId);
  if (!recent) return res.status(502).json({ error: "Could not read the conversation from GHL." });

  let saved = 0;
  for (const m of recent.messages) {
    if (m.at && Date.now() - new Date(m.at).getTime() > FRESH_MS) continue;
    try { if (await saveInbound({ phone: recent.phone, body: m.body, sid: m.sid, at: m.at })) saved++; }
    catch (err) { console.error("Inbound SMS save error:", err); }
  }
  return res.status(200).json({ ok: true, saved });
}
