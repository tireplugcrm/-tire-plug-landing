/**
 * Tools for the phone AI (an ElevenLabs agent answering the shop line; the T-Mobile shop cell forwards
 * every call to its Twilio number). Every call is run as a sale: quote, then book or save a lead.
 * ElevenLabs calls these mid-call as webhook tools:
 *   POST ?action=tires { size }               -> what we have in that size, our price, next-day options
 *   POST ?action=times { next_day? }          -> the next open appointment times (with the "at" to book)
 *   POST ?action=book  { name, phone, at, ... }-> books it through /api/submit-booking (same checks, owner
 *                                                alert and confirmation text as the website)
 *   POST ?action=lead  { name, phone, ... }    -> not ready to book: a lead in Admin for the sales reps
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
import { openSlots } from "../../lib/booking.js";
import { onNewLead } from "../../lib/front-desk.js";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";

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
  const inStock = shelf.slice(0, 4).map((t) => ({ brand: t.brand, model: t.model, price: t.price ?? null, count: t.count ?? null, low: t.level === "low", availability: "in_stock" }));
  const order = nextDay.slice(0, 3).map((t) => ({ brand: t.brand, model: t.model, price: t.price, availability: "next_day" }));
  const parts = [];
  if (inStock.length) parts.push(`In stock today in ${key}: ${inStock.map(line).join("; ")}.`);
  if (order.length) parts.push(`${inStock.length ? "We can also get" : `Nothing on the shelf in ${key}, but we can get`} next day: ${order.map(line).join("; ")}. Next-day tires are installed tomorrow or later, never same day.`);
  if (!parts.length) parts.push(`We don't have ${key} on the shelf or next day. Offer to have someone text a quote.`);
  parts.push("Prices are per tire; mount and balance is extra, from $25 a wheel.");
  return { ok: true, size: key, in_stock: inStock, next_day: order, say: parts.join(" ") };
}

// The first few open times on the next days we have room ("at" is what book needs).
// Next-day tires can't go in today, so those calls skip today.
async function times(nextDayOnly) {
  const days = (await openSlots()).filter((d, i) => !(nextDayOnly && d.label.startsWith("Today"))).slice(0, 3);
  if (!days.length) return { ok: false, say: "No open times online. Save a lead so the team calls them to schedule." };
  // Four times spread over the day (earliest first), so the caller hears a morning and an afternoon.
  const spread = (s) => (s.length <= 4 ? s : [0, 1, 2, 3].map((i) => s[Math.round((i * (s.length - 1)) / 3)]));
  const out = days.map((d) => ({ day: d.label, times: spread(d.slots).map((s) => ({ label: s.label, at: s.at })) }));
  return { ok: true, days: out, say: `Open times: ${out.map((d) => `${d.day}: ${d.times.map((t) => t.label).join(", ")}`).join(". ")}. Offer two choices, not the whole list.` };
}

// Phone bookings go through the website's booking route, so they get the same slot check,
// next-day rule, owner alert and confirmation text, and show up in Admin like any booking.
async function book(b) {
  if (!toE164(b.phone) || !b.name || !b.at) return { ok: false, say: "I need their name, a cell number and a time from check_times before I can book." };
  const key = b.size ? parseSize(b.size) : null;
  const qty = Number(b.quantity) || 4;
  const tire = b.tire ? String(b.tire).trim() : null;
  const tires = key
    ? { tireSize: key, tireType: tire || "Find options", quantity: tire ? qty : undefined, price: Number(b.price) || undefined,
        service: tire ? `New Tires: ${tire} ${key} x${qty}` : `New Tires: ${key} (options to find)`,
        availability: tire ? (b.availability === "next_day" ? "next_day" : "in_stock") : "special_order" }
    : { tireSize: "N/A", tireType: "N/A", service: b.service || "Service (by phone)" };
  const r = await fetch(`${SITE}/api/submit-booking`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: b.name, phone: toE164(b.phone), email: "N/A", vehicle: b.vehicle || "N/A", ...tires,
      serviceTiming: "Booked by phone", appointmentAt: b.at, leadPriority: "HOT",
      smsConsent: b.sms_ok === true, marketingConsent: false, source: "Phone AI",
      notes: b.notes || undefined,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json().catch(() => ({}));
  console.log(`voice-agent: book ${b.at} -> ${r.status} ${data.code || ""}`);
  if (data.success) return { ok: true, when: data.appointment?.when, say: `Booked for ${data.appointment?.when}.${b.sms_ok ? " A confirmation text is on its way." : ""} Address is 2331 East Olympic Boulevard.` };
  if (data.code === "slot_taken") return { ok: false, say: `${data.error} Call check_times again and offer new times.` };
  return { ok: false, say: "The booking didn't save. Save a lead instead so the team calls them to lock in the time." };
}

// Not ready to book: saved as a lead in Admin (source "Phone AI") with the quote, so a rep follows up.
async function lead(b) {
  if (!toE164(b.phone)) return { ok: false, say: "Ask for a good cell number first." };
  const key = b.size ? parseSize(b.size) : null;
  const timing = /today|asap|now/i.test(b.timing || "") ? "ASAP" : /tomorrow/i.test(b.timing || "") ? "Tomorrow" : /week/i.test(b.timing || "") ? "This Week" : "Just Pricing";
  const { data, error } = await supabaseAdmin.from("leads").insert({
    name: b.name || null, phone: toE164(b.phone), vehicle: b.vehicle || null,
    tire_size: key, tire_type: b.tire || null,
    service: key ? `New Tires: ${b.tire ? `${b.tire} ` : ""}${key}` : b.service || "Phone call",
    service_timing: timing, lead_priority: timing === "Just Pricing" ? "SHOPPING" : timing === "ASAP" ? "HOT" : "WARM",
    source: "Phone AI", tags: ["Phone AI"],
    raw: { ...b, smsConsent: b.sms_ok === true, via: "phone-ai" },
  }).select("*").single();
  if (error) throw error;
  await onNewLead(data);
  return { ok: true, say: "Saved. Tell them someone from the shop will follow up, and they can call back anytime." };
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
  const body = req.body || {};
  const { size, phone } = body;
  const action = req.query.action || body.action; // each ElevenLabs tool posts to its own ?action=
  try {
    if (action === "tires") return res.status(200).json(await tires(size));
    if (action === "times") return res.status(200).json(await times(body.next_day === true));
    if (action === "book") return res.status(200).json(await book(body));
    if (action === "lead") return res.status(200).json(await lead(body));
    if (action === "text") return res.status(200).json(await text(phone, size));
    return res.status(400).json({ ok: false, error: "unknown action" });
  } catch (err) {
    console.error("voice-agent:", err);
    return res.status(200).json({ ok: false, say: "I can't look that up right now. Offer to have someone call or text them back." });
  }
}
