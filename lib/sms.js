/**
 * Shared Twilio SMS sender (server-only).
 * Used by /api/admin/send-sms and the auto-greeting in submit-booking.
 * Returns { ok, sid, status, error }.
 */
import { toE164 } from "./phone.js";

function basicAuth() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

export async function sendSms({ to, body }) {
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
 * Schedule a text to send later (Twilio holds it). Requires a Messaging Service.
 * sendAt = ISO 8601 string, 15min–7days out. Returns { ok, sid }.
 */
export async function scheduleSms({ to, body, sendAt }) {
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
