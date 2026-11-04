/**
 * Tools for the phone AI (an ElevenLabs agent answering the shop line; the T-Mobile shop cell forwards
 * every call to its Twilio number). Every call is run as a sale: quote, then book or save a lead.
 * ElevenLabs calls these mid-call as webhook tools:
 *   POST ?action=tires { size }               -> what we have in that size, our price per tire (and installed), next-day options
 *   POST ?action=times { next_day? }          -> the next open appointment times (with the "at" to book)
 *   POST ?action=book  { name, phone, at, ... }-> books it through /api/submit-booking (same checks, owner
 *                                                alert and confirmation text as the website)
 *   POST ?action=lead  { name, phone, ... }    -> not ready to book: a lead in Admin for the sales reps
 *   POST ?action=text  { phone, size?, tire?, price?, quantity?, alignment?, tesla? }
 *                                              -> texts the price breakdown for the chosen tire, or the size/booking link
 *                      { phone, brakes, rotors?, epb?, vehicle? } -> texts the brake quote breakdown
 *   POST ?action=brakes { vehicle, brakes, rotors?, epb? } -> exact brake price when the car's AutoZone parts are on file
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
import { openSlots, fmtWhen, laInstant, laParts } from "../../lib/booking.js";
import { onNewLead } from "../../lib/front-desk.js";
import { supabaseAdmin } from "../../lib/supabaseAdmin.js";
import { vendorForSize } from "../../lib/vendor-tires.js";
import { brakeParts, matchCar, BRAKE_PRICING } from "../../lib/brake-parts.js";

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

// Tire quotes are the price per tire, tire only (owner, Nov 3: no tax totals). Mount and balance is $25 a wheel,
// said only when the caller asks about install: $78 tire + $25 = $103 a tire installed. Tax (10% on the tires) is
// added at the shop and only mentioned if they ask. No tire fee in quotes.
export const INSTALL = 25, TAX = 0.1;
export const PAYMENT = "We take cash, Zelle and card (card adds 3%).";
const line = (t) => `${t.brand} ${t.model}${t.price != null ? `, ${money(t.price)} a tire (${money(t.installed)} installed)` : ", price by text"}${t.warranty ? `, ${t.warranty.replace(/(;| · ).*/, "")}` : ""}`;

async function tires(size, quantity, brand) {
  const qty = Math.min(Math.max(Math.round(Number(quantity)) || 4, 1), 8);
  const key = parseSize(size);
  if (!key) return { ok: false, say: "I didn't get a full tire size. Ask for the three numbers on the sidewall, like 225 65 17." };
  // 24-inch rims and up: the shop doesn't mount them.
  const rim = Number((key.match(/R(\d{2})/) || [])[1]);
  const big = rim >= 24 ? " We don't mount 24-inch wheels and up, so these are carry-out only (no install)." : "";
  const [shelf, nextDay, vendors, syncedAt] = await Promise.all([stockForSize(key), nextDayForSize(key), vendorForSize(key, qty), stockSyncedAt()]);
  // Treadwear warranty: the exact size's spec sheet (miles) when we have it, else the model's
  // feature lines (data/tire-models.json, e.g. "65,000-mile treadwear warranty (H/V-rated sizes)").
  // The website's warranty line first (lib/inventory.js warrantyText), so the phone and the tire cards agree; its
  // generic "Manufacturer's defect warranty" fallback gives way to a distributor's mileage warranty below.
  const site = (t) => {
    const w = t.warrantyText;
    if (!w || /^Manufacturer/.test(w)) return null;
    return /^[\d,]+ miles$/.test(w) ? `${w.replace(" miles", "-mile")} treadwear warranty` : w;
  };
  const warranty = (t) => site(t) || (t.specs?.warranty ? `${Number(t.specs.warranty).toLocaleString("en-US")}-mile treadwear warranty`
    : (t.features || []).filter((f) => /warranty/i.test(f)).join("; ") || null);
  // Warranty for every tire: our spec data first, else the distributor portal's warranty for the same brand + model.
  const vendorWarranty = new Map(vendors.filter((v) => v.warranty_miles).map((v) => [`${v.brand}|${v.model}`.toLowerCase().replace(/[^a-z0-9|]/g, ""), v.warranty_miles]));
  const miles = (n) => `${Number(n).toLocaleString("en-US")}-mile treadwear warranty`;
  const pick = (t, availability) => {
    const flat = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const vw = t.warranty_miles || vendorWarranty.get(`${t.brand}|${t.model}`.toLowerCase().replace(/[^a-z0-9|]/g, ""))
      || vendors.find((v) => v.warranty_miles && flat(v.brand) === flat(t.brand) && flat(t.model).length >= 4
        && (flat(v.model).startsWith(flat(t.model)) || flat(t.model).startsWith(flat(v.model))))?.warranty_miles;
    return { brand: t.brand, model: t.model, price: t.price ?? null, installed: t.price != null ? t.price + INSTALL : null, warranty: warranty(t) || (vw ? miles(vw) : null) || (t.warrantyText ? "manufacturer's defect warranty" : null), availability };
  };
  // A caller asking for a brand ("Goodyear?") gets that brand's options first, from the shelf AND the order-in list, even if
  // they aren't the cheapest. (Before, only the 4 cheapest shelf tires were checked, so a Goodyear on the shelf was missed.)
  const want = String(brand || "").toLowerCase().replace(/[^a-z]/g, "");
  const isWanted = (t) => want && String(t.brand).toLowerCase().replace(/[^a-z]/g, "").includes(want);
  // No brand asked: good / better / best from the shelf (owner, Nov 3): the cheapest, a middle one and the best (priciest),
  // instead of just the cheapest few. shelf comes cheapest first; unpriced tires sort last and are skipped here.
  // Only tires we have enough of for this caller: count is the shelf count capped at 4 (null = not counted, kept).
  const enough = shelf.filter((t) => t.count == null || t.count >= qty);
  const short = shelf.filter((t) => t.count != null && t.count < qty);
  const priced = enough.filter((t) => t.price != null);
  const tiers = priced.length > 3
    ? [["good", priced[0]], ["better", priced[Math.floor((priced.length - 1) / 2)]], ["best", priced[priced.length - 1]]]
    : priced.map((t, i, a) => [a.length === 1 ? "good" : i === 0 ? "good" : i === a.length - 1 ? "best" : "better", t]);
  const shelfPicks = want
    ? [...enough.filter(isWanted), ...enough.filter((t) => !isWanted(t))].slice(0, 6).map((t) => [isWanted(t) ? "requested" : "", t])
    : tiers;
  const inStock = shelfPicks.map(([tier, t]) => ({ ...pick(t, "in_stock"), tier: tier || null, count: t.count ?? null, low: t.level === "low" }));
  // Every next-day brand, so a caller asking for one by name (Falken, Lexani...) gets its price.
  // Plus every distributor's catalog (lib/vendor-tires.js) for brands the shelf and next-day list don't have.
  const nk = (t) => `${t.brand}|${t.model}`.toLowerCase().replace(/[^a-z0-9|]/g, "");
  const known = new Set([...shelf, ...nextDay].map(nk));
  const fromVendors = vendors.filter((t) => !known.has(nk(t))).map((t) => ({ ...pick(t, "next_day"), eta_days: t.eta_days }));
  let order = [...nextDay.map((t) => pick(t, "next_day")), ...fromVendors].sort((a, b) => (a.price ?? 1e9) - (b.price ?? 1e9));
  if (want) order = [...order.filter(isWanted), ...order.filter((t) => !isWanted(t))];
  order = order.slice(0, 10);
  const parts = [];
  if (short.length) parts.push(`Not enough on the shelf for ${qty}: ${short.slice(0, 4).map((t) => `${t.brand} ${t.model} (only ${t.count})`).join(", ")}; don't offer these for ${qty} tires.`);
  if (inStock.length) parts.push(`In stock today in ${key}: ${inStock.map((t) => `${t.tier ? `${t.tier.toUpperCase()}: ` : ""}${line(t)}`).join("; ")}.${!want && inStock.length >= 3 ? " Quote these three as good, better, best." : ""}`);
  if (order.length) parts.push(`${inStock.length ? "We can also get" : `Nothing on the shelf in ${key}, but we can get`} next day: ${order.map((t) => line(t)).join("; ")}. Next-day tires are installed tomorrow or later, never same day.`);
  if (!parts.length) parts.push(`We don't have ${key} on the shelf or next day. Offer to have the team find it and text the exact price: ask for their name and best number, then call save_lead (never say "lead" to the caller).`);
  parts.push(`Say the price PER TIRE (tire only) and its warranty, like "the Lexani LXUHP-207, fifty thousand mile warranty, is seventy-eight a tire". Don't add install or tax unless they ask. If they ask whether it includes install and balance: it's ${INSTALL} a wheel, so the tire's price plus ${INSTALL} (its "installed" price) a tire. Tax only if they ask: 10% on the tires, added at the shop.${big}`);
  // Shelf counts come from the last Tekmetric sync (by hand, a few times a day), so a tire sold since may still show.
  const hours = syncedAt ? (Date.now() - new Date(syncedAt)) / 36e5 : null;
  if (inStock.length && hours != null && hours > 6) parts.push(`Shelf counts were last updated ${Math.round(hours)} hours ago: when they pick an in-stock tire, say the guys will have it pulled and ready for them (we confirm it on the shelf when we text).`);
  if (want) parts.unshift(inStock.some(isWanted) ? `${brand} is IN STOCK today: lead with it.` : order.some(isWanted) ? `${brand} can be ordered in (listed first).` : `No ${brand} available to quote in this size; offer the closest match and to get a ${brand} ordered (don't say "we don't have").`);
  return { ok: true, size: key, quantity: qty, in_stock: inStock, next_day: order, say: parts.join(" ") };
}

// The first few open times on the next days we have room ("at" is what book needs).
// Next-day tires can't go in today, so those calls skip today.
// With a time the caller asked for ("in 2 hours" = in_minutes 120, or want "2026-11-05T16:30" LA time), it
// returns the one open slot closest to it, so the agent can say it back and book right away (owner, Nov 3).
async function times(nextDayOnly, b = {}) {
  const all = (await openSlots()).filter((d) => !(nextDayOnly && d.label.startsWith("Today")));
  const inMin = Number(b.in_minutes);
  const m = String(b.want || "").match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  const target = inMin > 0 ? Date.now() + inMin * 60e3 : m ? laInstant(m[1], Number(m[2]) * 60 + Number(m[3])).getTime() : null;
  if (target) {
    const slots = all.flatMap((d) => d.slots.map((s) => ({ ...s, day: d.label })));
    // Closest slot, but not more than 15 minutes before the time they said (they can't be early).
    const best = slots.filter((s) => new Date(s.at) >= target - 15 * 60e3).sort((x, y) => Math.abs(new Date(x.at) - target) - Math.abs(new Date(y.at) - target))[0];
    if (!best) return { ok: false, say: "No time open near that. Offer the next open day." };
    const sameDay = laParts(new Date(best.at)).ymd === laParts(new Date(target)).ymd;
    return { ok: true, at: best.at, label: best.label, day: best.day,
      say: sameDay
        ? `Book ${best.day} at ${best.label} (at ${best.at}). Say it back in one line ("Perfect, I've got you down for ${best.label} ${best.day.startsWith("Today") ? "today" : best.day}") and call book_appointment with this at right away; if you don't have their name yet, ask it first.`
        : `That's after our last appointment that day. The closest is ${best.day} at ${best.label} (at ${best.at}); offer it in one line, and book it if they say yes.` };
  }
  const days = all.slice(0, 3);
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
  // Already booked on this call (they added an oil change after booking): add it to that appointment. Booking again
  // hit our own slot as "taken" and lost a caller who had just booked (owner's test call, Nov 3).
  const since = new Date(Date.now() - 60 * 60e3).toISOString();
  const { data: mine } = await supabaseAdmin.from("leads").select("*").eq("phone", toE164(b.phone)).eq("source", "Phone AI")
    .eq("appt_status", "confirmed").gte("appt_booked_at", since).order("appt_booked_at", { ascending: false }).limit(1).maybeSingle();
  if (mine) {
    const join = (x, y) => [...new Set([x, y].filter(Boolean))].join("; ");
    const when = fmtWhen(mine.appointment_at);
    if (Math.abs(new Date(b.at) - new Date(mine.appointment_at)) > 60e3) {
      return { ok: false, say: `They're already booked for ${when} on this call. Ask if they want to keep ${when} (then just add the service) or move it; don't book a second appointment.` };
    }
    await supabaseAdmin.from("leads").update({
      service: join(mine.service, b.service), vehicle: mine.vehicle || b.vehicle || null,
      raw: { ...mine.raw, notes: join(mine.raw?.notes, b.notes), added_by_phone: join(mine.raw?.added_by_phone, b.service || b.notes) },
    }).eq("id", mine.id);
    if (isBrakes(b) && !isBrakes(mine.raw || {})) await alertBrakeTech("booking", { ...mine.raw, ...b }, ` Booked ${when}.`);
    return { ok: true, when, say: `Added to their booking for ${when}; their time is the same. Say "Got it, I added it to your appointment" and keep going.` };
  }
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
  // Same caller again on this call (tires first, then brakes): add to that lead instead of a second one.
  const since = new Date(Date.now() - 30 * 60e3).toISOString();
  const { data: prior } = await supabaseAdmin.from("leads").select("*").eq("phone", toE164(b.phone)).eq("source", "Phone AI").gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (prior) {
    const join = (x, y) => [...new Set([x, y].filter(Boolean))].join("; ");
    const raw = { ...prior.raw, ...Object.fromEntries(Object.entries(b).filter(([, v]) => v != null && v !== "")), notes: join(prior.raw?.notes, b.notes), service: join(prior.raw?.service, b.service) };
    await supabaseAdmin.from("leads").update({
      name: prior.name || b.name || null, vehicle: prior.vehicle || b.vehicle || null,
      service: join(prior.service, key ? `New Tires: ${b.tire ? `${b.tire} ` : ""}${key}` : b.service), raw,
    }).eq("id", prior.id);
    if (isBrakes(b) && !isBrakes(prior.raw || {})) await alertBrakeTech("lead (not booked yet)", raw, " Call them back with the exact price.");
    return { ok: true, say: "Added to their request. Keep going; no need to tell them it's saved again." };
  }
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

// With a chosen tire and price, the text is the price breakdown (plus the alignment if added), before tax;
// otherwise it's the size page or booking link.
const ALIGN = { regular: 75, tesla: 90 };
function breakdown(b, key) {
  const qty = Number(b.quantity) || 4, price = Number(b.price);
  // $20 a wheel only as the phone close for 4 tires installed today (owner, Nov 3); otherwise $25.
  const perWheel = Number(b.install) === 20 && qty === 4 ? 20 : INSTALL;
  const tires = price * qty, install = perWheel * qty, total = tires + install;
  const align = b.alignment ? (/kumho/i.test(b.tire) && qty === 4 ? 49 : (b.tesla ? ALIGN.tesla : ALIGN.regular) - (qty === 4 ? 10 : 0)) : 0;
  const d = (n) => `$${n.toFixed(2).replace(/\.00$/, "")}`;
  return [
    `The Tire Plug: your quote for ${qty}x ${b.tire} ${key}`,
    `Tire: ${d(price)} each`,
    `Mount & balance: ${d(perWheel)} a wheel (${d(price + perWheel)} a tire installed)${perWheel < INSTALL ? ", today's deal" : ""}`,
    `${qty} tires installed: ${d(total)}`,
    ...(align ? [`Alignment: ${d(align)}`, `Total: ${d(total + align)}`] : []),
    `Plus tax.`,
    PAYMENT,
    `2331 E Olympic Blvd, Los Angeles. Questions? Call 562-500-4625.`,
  ].join("\n");
}

// Brake quote (owner's pricing: parts + $60 a wheel, +$75 electric parking brake, rotors parts + $40 each).
// Exact when the car's AutoZone parts are on file (lib/brake-parts.js: the cheapest pads and rotors); otherwise
// the knowledge base's starting figures, and Jarvis texts the exact price within minutes.
// brakes: "front" | "rear" | "all"; rotors, epb: booleans. Before tax (brakes never quote with tax).
export const BRAKE = { padsPerAxle: 150, epb: 75, rotorEach: 95 };
async function brakeQuote(b) {
  const which = /all|both|four|4/i.test(b.brakes || "") ? "all" : /rear|back/i.test(b.brakes || "") ? "rear" : "front";
  const car = b.vehicle ? matchCar(await brakeParts().catch(() => []), b.vehicle) : null;
  const sides = which === "all" ? ["front", "rear"] : [which];
  const lines = [];
  let exact = !!car && !car.near; // a nearby model year's parts: a close estimate, not exact
  const brand = car?.pads_brand ? `${car.pads_brand}${car.pads_warranty ? `, ${car.pads_warranty} warranty` : ""}` : "Duralast, lifetime warranty";
  for (const side of sides) {
    const cost = car?.[`${side}_pads`];
    if (cost == null) exact = false;
    lines.push([`${side === "front" ? "Front" : "Rear"} pads (${brand})`, cost != null ? Math.round(cost + BRAKE_PRICING.padsAxle) : BRAKE.padsPerAxle]);
  }
  if (b.epb && which !== "front") lines.push(["Electric parking brake", BRAKE_PRICING.epb]);
  if (b.rotors) for (const side of sides) {
    const cost = car?.[`${side}_rotor`];
    if (cost == null) exact = false;
    const each = cost != null ? Math.round(cost + BRAKE_PRICING.rotorEach) : BRAKE.rotorEach;
    lines.push([`${side === "front" ? "Front" : "Rear"} rotors (2 x $${each})`, each * 2]);
  }
  return { which, lines, exact, total: lines.reduce((a, [, n]) => a + n, 0) };
}
async function brakeText(b) {
  const e = await brakeQuote(b);
  return [
    `The Tire Plug: brake ${e.exact ? "quote" : "estimate"}${b.vehicle ? ` for your ${b.vehicle}` : ""}`,
    ...e.lines.map(([l, n]) => `${l}: $${n}`),
    `${e.exact ? "Total" : "Estimated total"}: $${e.total} (before tax)`,
    e.exact ? `Parts and labor included.` : `We'll text you the exact price for your car in a few minutes.`,
    PAYMENT,
    `2331 E Olympic Blvd, Los Angeles. Questions? Call 562-500-4625.`,
  ].join("\n");
}
// check_brakes on the call: the price to say, exact or estimate.
async function brakes(b) {
  if (!b.vehicle || !/\b(19|20)\d{2}\b/.test(b.vehicle)) return { ok: false, say: "Get the year, make and model first (a VIN or plate works too), then check again." };
  const e = await brakeQuote(b);
  const parts = e.lines.map(([l, n]) => `${l.replace(/ \(.*/, "")} $${n}`).join(", ");
  return {
    ok: true, exact: e.exact, total: e.total, lines: e.lines,
    say: e.exact
      ? `Exact price for the ${b.vehicle}: ${parts}. Total $${e.total} before tax, parts and labor. Say the total as the price ("${e.total} for the ${e.which === "all" ? "front and rear" : e.which} brakes, parts and labor"), with the pads' warranty, then close.`
      : `No exact parts on file for this car yet. Estimate: ${parts}, about $${e.total} before tax. Say it as "about ${e.total}" and that they'll get the exact price by text in a few minutes (pass brakes, rotors, epb and vehicle to book_appointment or save_lead so the team looks it up), then close.`,
  };
}
const isBrakes = (b) => /brake|rotor/i.test(`${b.service || ""} ${b.notes || ""} ${b.brakes || ""}`);

// When tire_stock last synced from Tekmetric (app_settings 'stock_synced_at', set by the stock load).
async function stockSyncedAt() {
  try {
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "stock_synced_at").maybeSingle();
    return data?.value || null;
  } catch { return null; }
}

// Brake bookings and brake leads also text the brake tech (app_settings 'brake_alert_phone', kept out
// of this public repo), so he can confirm parts and the exact price.
async function alertBrakeTech(kind, b, extra = "") {
  try {
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "brake_alert_phone").maybeSingle();
    const to = toE164(data?.value);
    if (!to) return;
    const e = await brakeQuote(b);
    const body = `🛑 Brake ${kind} from the phone AI: ${b.name || "caller"} ${b.phone ? toE164(b.phone).slice(2).replace(/(\d{3})(\d{3})/, "$1-$2-") : ""}. ${b.vehicle || "vehicle not given"}. ${e.lines.map(([l]) => l.replace(/ \(.*/, "")).join(", ")}${b.epb ? " (electric parking brake)" : ""}. Quoted ${e.exact ? "" : "about "}$${e.total} before tax${e.exact ? " (exact, AutoZone parts on file)" : ""}.${extra}${b.notes ? ` Notes: ${b.notes}` : ""}`;
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
  const body = b.brakes ? await brakeText(b)
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
    if (action === "tires") return res.status(200).json(await tires(size, body.quantity, body.brand));
    if (action === "times") return res.status(200).json(await times(body.next_day === true, body));
    if (action === "book") return res.status(200).json(await book(body));
    if (action === "lead") return res.status(200).json(await lead(body));
    if (action === "brakes") return res.status(200).json(await brakes(body));
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
