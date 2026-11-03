/**
 * Tools for the phone AI (an ElevenLabs agent answering the shop line; the T-Mobile shop cell forwards
 * every call to its Twilio number). Every call is run as a sale: quote, then book or save a lead.
 * ElevenLabs calls these mid-call as webhook tools:
 *   POST ?action=tires { size }               -> what we have in that size, our price and out-the-door for 4, next-day options
 *   POST ?action=times { next_day? }          -> the next open appointment times (with the "at" to book)
 *   POST ?action=book  { name, phone, at, ... }-> books it through /api/submit-booking (same checks, owner
 *                                                alert and confirmation text as the website)
 *   POST ?action=lead  { name, phone, ... }    -> not ready to book: a lead in Admin for the sales reps
 *   POST ?action=text  { phone, size?, tire?, price?, quantity?, alignment?, tesla? }
 *                                              -> texts the out-the-door breakdown for the chosen tire, or the size/booking link
 *                      { phone, brakes, rotors?, epb?, vehicle? } -> texts the brake estimate breakdown
 * Brake bookings and leads (book/lead with brakes in service/notes/brakes) also text the brake tech.
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
import { vendorForSize } from "../../lib/vendor-tires.js";

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

// Out-the-door for a set of 4 (owner, Nov 2026): tires + $25 a wheel mount and balance + 10% tax on
// the tires (no tire fee in quotes, owner's call 11-03). e.g. $125 tires: 500 + 100 + 50 = $650.
export const INSTALL = 25, TAX = 0.1;
export const outTheDoor = (price, qty = 4) => Math.round(price * qty + INSTALL * qty + TAX * price * qty);
export const PAYMENT = "We take cash, Zelle and card (card adds 3%).";
// Out the door for the quantity the caller wants (2 tires is common), not always 4.
const line = (t, qty) => `${t.brand} ${t.model}${t.price != null ? `, ${money(t.price)} a tire, ${money(t.otd)} out the door for ${qty}` : ", price by text"}`;

async function tires(size, quantity) {
  const qty = Math.min(Math.max(Math.round(Number(quantity)) || 4, 1), 8);
  const key = parseSize(size);
  if (!key) return { ok: false, say: "I didn't get a full tire size. Ask for the three numbers on the sidewall, like 225 65 17." };
  // 24-inch rims and up: the shop doesn't mount them.
  const rim = Number((key.match(/R(\d{2})/) || [])[1]);
  const big = rim >= 24 ? " We don't mount 24-inch wheels and up, so these are carry-out only (no install)." : "";
  const [shelf, nextDay, vendors] = await Promise.all([stockForSize(key), nextDayForSize(key), vendorForSize(key, qty)]);
  // Treadwear warranty: the exact size's spec sheet (miles) when we have it, else the model's
  // feature lines (data/tire-models.json, e.g. "65,000-mile treadwear warranty (H/V-rated sizes)").
  const warranty = (t) => (t.specs?.warranty ? `${Number(t.specs.warranty).toLocaleString("en-US")}-mile treadwear warranty`
    : (t.features || []).filter((f) => /warranty/i.test(f)).join("; ") || null);
  const pick = (t, availability) => ({ brand: t.brand, model: t.model, price: t.price ?? null, otd: t.price != null ? outTheDoor(t.price, qty) : null, otd_4: t.price != null ? outTheDoor(t.price) : null, warranty: warranty(t), availability });
  const inStock = shelf.slice(0, 4).map((t) => ({ ...pick(t, "in_stock"), count: t.count ?? null, low: t.level === "low" }));
  // Every next-day brand, so a caller asking for one by name (Falken, Lexani...) gets its price.
  // Plus every distributor's catalog (lib/vendor-tires.js) for brands the shelf and next-day list don't have.
  const nk = (t) => `${t.brand}|${t.model}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
  const known = new Set([...shelf, ...nextDay].map(nk));
  const fromVendors = vendors.filter((t) => !known.has(nk(t))).map((t) => ({ ...pick(t, "next_day"), eta_days: t.eta_days }));
  const order = [...nextDay.map((t) => pick(t, "next_day")), ...fromVendors].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9)).slice(0, 10);
  const parts = [];
  if (inStock.length) parts.push(`In stock today in ${key}: ${inStock.map((t) => line(t, qty)).join("; ")}.`);
  if (order.length) parts.push(`${inStock.length ? "We can also get" : `Nothing on the shelf in ${key}, but we can get`} next day: ${order.map((t) => line(t, qty)).join("; ")}. Next-day tires are installed tomorrow or later, never same day.`);
  if (!parts.length) parts.push(`We don't have ${key} on the shelf or next day. Offer to have the team find it and text the exact price: ask for their name and best number, then call save_lead (never say "lead" to the caller).`);
  parts.push(`Out the door for ${qty} includes ${INSTALL} a wheel mount and balance and 10% tax on the tires. Each tire's treadwear warranty is in its "warranty" field.${big}`);
  return { ok: true, size: key, quantity: qty, in_stock: inStock, next_day: order, say: parts.join(" ") };
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
      // For Jarvis's exact brake quote (pages/api/agent.js quote-queue); stored in the lead's raw.
      brakes: b.brakes || undefined, rotors: b.rotors ?? undefined, epb: b.epb ?? undefined, vin_or_plate: b.vin_or_plate || undefined,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json().catch(() => ({}));
  console.log(`voice-agent: book ${b.at} -> ${r.status} ${data.code || ""}`);
  if (data.success && isBrakes(b)) await alertBrakeTech("booking", b, ` Booked ${data.appointment?.when}.`);
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
  if (isBrakes(b)) await alertBrakeTech("lead (not booked yet)", b, " Call them back with the exact price.");
  return { ok: true, say: "Saved. Tell them someone from the shop will follow up, and they can call back anytime." };
}

// With a chosen tire and price, the text is the out-the-door breakdown (plus the alignment if added);
// otherwise it's the size page or booking link.
const ALIGN = { regular: 75, tesla: 90 };
function breakdown(b, key) {
  const qty = Number(b.quantity) || 4, price = Number(b.price);
  const tires = price * qty, install = INSTALL * qty, tax = TAX * tires;
  const otd = tires + install + tax; // to the cent here; spoken prices round to the dollar
  const align = b.alignment ? (/kumho/i.test(b.tire) && qty === 4 ? 49 : (b.tesla ? ALIGN.tesla : ALIGN.regular) - (qty === 4 ? 10 : 0)) : 0;
  const d = (n) => `$${n.toFixed(2).replace(/\.00$/, "")}`;
  return [
    `The Tire Plug: your quote for ${qty}x ${b.tire} ${key}`,
    `Tires: ${qty} x ${d(price)} = ${d(tires)}`,
    `Mount & balance: ${d(install)}`,
    `Tax (10% on tires): ${d(tax)}`,
    `Out the door: ${d(otd)}`,
    ...(align ? [`Alignment: ${d(align)}`, `Total: ${d(otd + align)}`] : []),
    PAYMENT,
    `2331 E Olympic Blvd, Los Angeles. Questions? Call 562-500-4625.`,
  ].join("\n");
}

// Brake estimate (owner's pricing: parts + $60 a wheel, +$75 electric parking brake, rotors parts +
// $40 each), using the knowledge base's starting figures until parts are looked up for the exact car.
// brakes: "front" | "rear" | "all"; rotors, epb: booleans. Before tax (brakes never quote with tax).
export const BRAKE = { padsPerAxle: 150, epb: 75, rotorEach: 95 };
function brakeEstimate(b) {
  const which = /all|both|four|4/i.test(b.brakes || "") ? "all" : /rear|back/i.test(b.brakes || "") ? "rear" : "front";
  const axles = which === "all" ? 2 : 1;
  const lines = [];
  if (which !== "rear") lines.push(["Front pads (Duralast, lifetime warranty)", BRAKE.padsPerAxle]);
  if (which !== "front") lines.push(["Rear pads (Duralast, lifetime warranty)", BRAKE.padsPerAxle]);
  if (b.epb && which !== "front") lines.push(["Electric parking brake", BRAKE.epb]);
  if (b.rotors) lines.push([`Rotors (${2 * axles} x $${BRAKE.rotorEach})`, BRAKE.rotorEach * 2 * axles]);
  return { which, lines, total: lines.reduce((a, [, n]) => a + n, 0) };
}
function brakeText(b) {
  const e = brakeEstimate(b);
  return [
    `The Tire Plug: brake estimate${b.vehicle ? ` for your ${b.vehicle}` : ""}`,
    ...e.lines.map(([l, n]) => `${l}: $${n}`),
    `Estimated total: $${e.total} (before tax)`,
    `Exact price is confirmed for your car before any work starts.`,
    PAYMENT,
    `2331 E Olympic Blvd, Los Angeles. Questions? Call 562-500-4625.`,
  ].join("\n");
}
const isBrakes = (b) => /brake|rotor/i.test(`${b.service || ""} ${b.notes || ""} ${b.brakes || ""}`);

// Brake bookings and brake leads also text the brake tech (app_settings 'brake_alert_phone', kept out
// of this public repo), so he can confirm parts and the exact price.
async function alertBrakeTech(kind, b, extra = "") {
  try {
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "brake_alert_phone").maybeSingle();
    const to = toE164(data?.value);
    if (!to) return;
    const e = brakeEstimate(b);
    const body = `🛑 Brake ${kind} from Mary (phone AI): ${b.name || "caller"} ${b.phone ? toE164(b.phone).slice(2).replace(/(\d{3})(\d{3})/, "$1-$2-") : ""}. ${b.vehicle || "vehicle not given"}. ${e.lines.map(([l]) => l.replace(/ \(.*/, "")).join(", ")}${b.epb ? " (electric parking brake)" : ""}. Quoted about $${e.total} before tax.${extra}${b.notes ? ` Notes: ${b.notes}` : ""}`;
    const r = await sendSms({ to, body });
    console.log(`voice-agent: brake alert ${kind} ${r.ok ? "sent" : `failed: ${r.error}`}`);
  } catch (err) {
    console.error("voice-agent: brake alert", err);
  }
}

async function text(phone, size, b = {}) {
  const to = toE164(phone);
  if (!to) return { ok: false, say: "That phone number doesn't look right. Ask for the 10-digit cell number." };
  const key = size ? parseSize(size) : null;
  const url = key ? `${SITE}/tires/${sizeToSlug(key)}` : `${SITE}/book`;
  const body = b.brakes ? brakeText(b)
    : key && b.tire && Number(b.price) > 0 ? breakdown(b, key)
    : key ? `The Tire Plug: here are the ${key} tires we talked about, with prices. Pick one to book: ${url}`
    : `The Tire Plug: book your appointment here: ${url}`;
  const r = await sendSms({ to, body });
  console.log(`voice-agent: text to ...${to.slice(-4)} ${r.ok ? "sent" : `failed: ${r.error}`}`);
  return r.ok
    ? { ok: true, say: b.tire || b.brakes ? "Sent. Tell the caller the price breakdown is on its way by text." : "Sent. Tell the caller the link is on its way by text." }
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
    if (action === "tires") return res.status(200).json(await tires(size, body.quantity));
    if (action === "times") return res.status(200).json(await times(body.next_day === true));
    if (action === "book") return res.status(200).json(await book(body));
    if (action === "lead") return res.status(200).json(await lead(body));
    if (action === "text") return res.status(200).json(await text(phone, size, body));
    // Shows the brake tech what a real alert looks like (labeled SAMPLE; no lead or booking is made).
    if (action === "brake_alert_sample") {
      await alertBrakeTech("booking (SAMPLE, not a real customer)", { name: "Sample caller", vehicle: "2022 Honda Civic", brakes: "all", rotors: true, epb: true }, " Booked Tue, Nov 4, 9:00 AM. From now on Mary texts you like this for every brake booking or brake lead.");
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "unknown action" });
  } catch (err) {
    console.error("voice-agent:", err);
    return res.status(200).json({ ok: false, say: "I can't look that up right now. Offer to have someone call or text them back." });
  }
}
