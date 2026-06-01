/**
 * Shared Twilio SMS sender (server-only).
 * Used by /api/admin/send-sms and the auto-greeting in submit-booking.
 * Returns { ok, sid, status, error }.
 */
import { toE164 } from "./phone.js";

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
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toNumber, From: from, Body: body }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.message || "Text failed to send." };
    return { ok: true, sid: data.sid, status: data.status || "sent" };
  } catch (err) {
    return { ok: false, error: "Could not reach Twilio." };
  }
}
