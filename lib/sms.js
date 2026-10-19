/**
 * Shared SMS sender (server-only).
 * Used by /api/admin/send-sms, the auto-greeting in submit-booking, follow-ups and alerts.
 * Returns { ok, sid, status, error }.
 *
 * Two providers, same interface:
 *  - GoHighLevel (preferred when GHL_API_TOKEN + GHL_LOCATION_ID are set): texts go out from the
 *    shop's A2P-approved GHL number (562-250-3737) and show up in GHL Conversations too.
 *    Optional GHL_FROM_NUMBER picks the sender; otherwise GHL uses the default number.
 *  - Twilio (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) as the fallback.
 * GHL message ids are stored as "ghl:<id>" so a later cancel goes to the right provider.
 */
import { toE164 } from "./phone.js";

const GHL_BASE = "https://services.leadconnectorhq.com";
const ghlOn = () => !!(process.env.GHL_API_TOKEN && process.env.GHL_LOCATION_ID);

/** Is any texting provider set up? */
export const smsConfigured = () => ghlOn() || !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
/** Can we hand off a text to be sent later (follow-up sequence)? */
export const canScheduleSms = () => ghlOn() || !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_MESSAGING_SERVICE_SID);

async function ghl(path, { method = "GET", body, version = "2021-04-15" } = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_TOKEN}`,
      Version: version,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// GHL texts a contact, not a number: find-or-create the contact for this phone.
async function ghlContactId(phone) {
  const r = await ghl("/contacts/upsert", { method: "POST", version: "2021-07-28", body: { locationId: process.env.GHL_LOCATION_ID, phone } });
  return r.ok ? r.data?.contact?.id || null : null;
}

/**
 * Recent inbound SMS for a GHL contact, read straight from GHL (so the reply webhook needs no
 * shared secret: a forged call can only make us re-read real messages). Returns
 * { phone, messages: [{ sid, body, at }] } or null.
 */
export async function ghlRecentInbound(contactId) {
  if (!ghlOn() || !contactId) return null;
  try {
    const q = new URLSearchParams({ locationId: process.env.GHL_LOCATION_ID, contactId, limit: "1" });
    const conv = (await ghl(`/conversations/search?${q}`)).data?.conversations?.[0];
    if (!conv?.id) return null;
    const r = await ghl(`/conversations/${conv.id}/messages?limit=10&type=TYPE_SMS`);
    const list = r.data?.messages?.messages || [];
    const messages = list
      .filter((m) => m.direction === "inbound" && m.contactId === contactId && m.body)
      .map((m) => ({ sid: `ghl:${m.id}`, body: m.body, at: m.dateAdded }));
    return { phone: conv.phone || null, messages };
  } catch (err) {
    return null;
  }
}

async function ghlSend({ to, body, sendAt }) {
  try {
    const contactId = await ghlContactId(to);
    if (!contactId) return { ok: false, error: "Could not find or create the GHL contact." };
    const msg = { type: "SMS", contactId, message: body };
    if (process.env.GHL_FROM_NUMBER) msg.fromNumber = toE164(process.env.GHL_FROM_NUMBER);
    if (sendAt) msg.scheduledTimestamp = Math.floor(new Date(sendAt).getTime() / 1000);
    const r = await ghl("/conversations/messages", { method: "POST", body: msg });
    if (!r.ok || !r.data?.messageId) return { ok: false, error: r.data?.message || "Text failed to send." };
    return { ok: true, sid: `ghl:${r.data.messageId}`, status: sendAt ? "scheduled" : "sent" };
  } catch (err) {
    return { ok: false, error: "Could not reach GoHighLevel." };
  }
}

function basicAuth() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function sendSms({ to, body }) {
  if (ghlOn()) {
    if (!toE164(to)) return { ok: false, error: "Invalid destination phone number." };
    if (!body || !body.trim()) return { ok: false, error: "Message is empty." };
    return ghlSend({ to: toE164(to), body });
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return { ok: false, error: "Twilio not configured." };

  const toNumber = toE164(to);
  if (!toNumber) return { ok: false, error: "Invalid destination phone number." };
  if (!body || !body.trim()) return { ok: false, error: "Message is empty." };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: toNumber, From: from, Body: body }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || "Text failed to send." };
    return { ok: true, sid: data.sid, status: data.status || "sent" };
  } catch (err) {
    return { ok: false, error: "Could not reach Twilio." };
  }
}

/**
 * Schedule a text to send later (GHL or Twilio holds it). Twilio requires a Messaging Service.
 * sendAt = ISO 8601 string, 15min–7days out. Returns { ok, sid }.
 */
export async function scheduleSms({ to, body, sendAt }) {
  if (ghlOn()) {
    if (!toE164(to)) return { ok: false, error: "Invalid destination phone number." };
    return ghlSend({ to: toE164(to), body, sendAt });
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const mgSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || !mgSid) return { ok: false, error: "Twilio messaging service not configured." };

  const toNumber = toE164(to);
  if (!toNumber) return { ok: false, error: "Invalid destination phone number." };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: toNumber, MessagingServiceSid: mgSid, Body: body, ScheduleType: "fixed", SendAt: sendAt }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || "Schedule failed." };
    return { ok: true, sid: data.sid };
  } catch (err) {
    return { ok: false, error: "Could not reach Twilio." };
  }
}

/** Cancel a still-scheduled message. Returns { ok }. */
export async function cancelScheduledSms(messageSid) {
  if (String(messageSid || "").startsWith("ghl:")) {
    if (!process.env.GHL_API_TOKEN) return { ok: false };
    try { return { ok: (await ghl(`/conversations/messages/${messageSid.slice(4)}/schedule`, { method: "DELETE" })).ok }; }
    catch (err) { return { ok: false }; }
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !messageSid) return { ok: false };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${messageSid}.json`, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ Status: "canceled" }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false };
  }
}
