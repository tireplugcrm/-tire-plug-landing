/**
 * Tools for the phone AI (an ElevenLabs agent answering the shop line, forwarded from Nextiva).
 * ElevenLabs calls these mid-call as webhook tools:
 *   POST ?action=tires { size }               -> what we have in that size, our price, next-day options
 *   POST ?action=text  { phone, size? }       -> texts the caller the size page (or booking page) link
 * The agent itself is created by scripts/voice-agent-setup.mjs.
 * Header x-voice-key must equal VOICE_AGENT_KEY (set in Vercel and on each ElevenLabs tool).
 * Answers are short plain sentences the agent can read out; never cost or the real count above 4.
 */
import crypto from "node:crypto";
import { stockForSize, nextDayForSize } from "../../lib/inventory.js";
import { sizeKey, sizeToSlug } from "../../lib/tire-catalog.js";
import { sendSms } from "../../lib/sms.js";
import { toE164 } from "../../lib/phone.js";
import { SITE } from "../../lib/invoices.js";

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Spoken sizes come in loose ("two sixty-five seventy seventeen" is turned into digits by the agent,
// but "265 70 17", "265/70-17" or "LT265/70R17" all happen): pull out the three numbers.
function parseSize(s) {
  const t = String(s || "").toUpperCase().replace(/\s+/g, " ");
  const flot = t.match(/(\d{2})\s*X\s*(\d{1,2}(?:\.\d{1,2})?)\s*R?\s*(\d{2})/);
  if (flot) return `${flot[1]}X${Number(flot[2]).toFixed(2)}R${flot[3]}`;
  const m = t.match(/(\d{3})\D{0,3}(\d{2})\D{0,3}(\d{2}(?:\.5)?)/);
  return m ? sizeKey(`${m[1]}/${m[2]}R${m[3]}`) : null;
}

const money = (n) => `$${Math.round(n)}`;
const line = (t) => `${t.brand} ${t.model}${t.price != null ? `, ${money(t.price)} a tire` : ", price by text"}`;

async function tires(size) {
  const key = parseSize(size);
  if (!key) return { ok: false, say: "I didn't get a full tire size. Ask for the three numbers on the sidewall, like 225 65 17." };
  const [shelf, nextDay] = await Promise.all([stockForSize(key), nextDayForSize(key)]);
  const inStock = shelf.slice(0, 4).map((t) => ({ brand: t.brand, model: t.model, price: t.price ?? null, count: t.count ?? null, low: t.level === "low" }));
  const order = nextDay.slice(0, 3).map((t) => ({ brand: t.brand, model: t.model, price: t.price }));
  const parts = [];
  if (inStock.length) parts.push(`In stock today in ${key}: ${inStock.map(line).join("; ")}.`);
  if (order.length) parts.push(`${inStock.length ? "We can also get" : `Nothing on the shelf in ${key}, but we can get`} next day: ${order.map(line).join("; ")}. Next-day tires are installed tomorrow or later, never same day.`);
  if (!parts.length) parts.push(`We don't have ${key} on the shelf or next day. Offer to have someone text a quote.`);
  parts.push("Prices are per tire; mount and balance is extra, from $25 a wheel.");
  return { ok: true, size: key, in_stock: inStock, next_day: order, say: parts.join(" ") };
}

async function text(phone, size) {
  const to = toE164(phone);
  if (!to) return { ok: false, say: "That phone number doesn't look right. Ask for the 10-digit cell number." };
  const key = size ? parseSize(size) : null;
  const url = key ? `${SITE}/tires/${sizeToSlug(key)}` : `${SITE}/book`;
  const body = key
    ? `The Tire Plug: here are the ${key} tires we talked about, with prices. Pick one to book: ${url}`
    : `The Tire Plug: book your appointment here: ${url}`;
  const r = await sendSms({ to, body });
  console.log(`voice-agent: text to ...${to.slice(-4)} ${r.ok ? "sent" : `failed: ${r.error}`}`);
  return r.ok
    ? { ok: true, say: "Sent. Tell the caller the link is on its way by text." }
    : { ok: false, say: "The text didn't go through. Give them the website instead: tireplugla.com." };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const key = process.env.VOICE_AGENT_KEY || "";
  if (key.length < 32 || !same(req.headers["x-voice-key"] || "", key)) return res.status(401).end();
  const { size, phone } = req.body || {};
  const action = req.query.action || req.body?.action; // each ElevenLabs tool posts to its own ?action=
  try {
    if (action === "tires") return res.status(200).json(await tires(size));
    if (action === "text") return res.status(200).json(await text(phone, size));
    return res.status(400).json({ ok: false, error: "unknown action" });
  } catch (err) {
    console.error("voice-agent:", err);
    return res.status(200).json({ ok: false, say: "I can't look that up right now. Offer to have someone call or text them back." });
  }
}
