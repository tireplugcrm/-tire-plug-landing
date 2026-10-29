/**
 * /deals and /sms sign-up: name + mobile (+ email) with the marketing consent box ticked.
 * Logs the consent (lib/consent.js) and sends the opt-in confirmation text carriers expect.
 */
import { recordOptIn } from "../../lib/consent.js";
import { sendSms } from "../../lib/sms.js";
import { digits10 } from "../../lib/phone.js";

const SOURCES = { counter: "counter-qr", invoice: "invoice-qr", text: "text-link", web: "deals-page", sms: "sms-page" };
const CONFIRM_TEXT = "The Tire Plug: you're signed up for tire deals and service reminders. Up to 4 msgs/month. Msg & data rates may apply. Reply STOP to opt out, HELP for help.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { name, phone, email, consent, src, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true }); // honeypot: bots fill every field
  if (consent !== true) return res.status(400).json({ error: "Please tick the box to sign up." });
  if (digits10(phone).length !== 10) return res.status(400).json({ error: "Please enter a 10-digit mobile number." });

  const out = await recordOptIn({ name, phone, email, source: SOURCES[src] || SOURCES.web, req });
  if (!out.ok) return res.status(500).json({ error: "Something went wrong. Please try again or call (562) 500-4625." });
  await sendSms({ to: phone, body: CONFIRM_TEXT }).catch(() => null);
  return res.status(200).json({ ok: true });
}
