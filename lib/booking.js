/**
 * Online appointment slots for the booking form.
 * Hours match SHOP_FACTS (Olympic: Mon–Fri 9–7, Sat 9–6, Sun 10–4), 30-minute slots, the last
 * one an hour before close. Each slot takes `booking_capacity` cars (app_settings, default 2).
 * All times are Los Angeles wall time; stored as UTC timestamps.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";

export const TZ = "America/Los_Angeles";
// [open, close] in minutes after midnight, by weekday (0 = Sunday).
const HOURS = { 0: [600, 960], 1: [540, 1140], 2: [540, 1140], 3: [540, 1140], 4: [540, 1140], 5: [540, 1140], 6: [540, 1080] };
const STEP = 30, LAST_BEFORE_CLOSE = 60, LEAD_MINUTES = 60;
export const DAYS_AHEAD = 14;
export const ACTIVE_APPT = ["confirmed", "checked_in"];

// Wall-clock parts of an instant in LA.
export function laParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ymd: `${p.year}-${p.month}-${p.day}`, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}

// The UTC instant for an LA wall time (handles daylight saving).
export function laInstant(ymd, minutes) {
  const [y, m, d] = ymd.split("-").map(Number);
  const want = Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  const wall = (t) => { const p = laParts(new Date(t)); return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm); };
  // Shift by LA's offset, then re-check the offset at the result: on the days the clocks
  // change, the offset at `want` (read as UTC) differs from the offset at the real instant.
  let t = want + (want - wall(want));
  t += want - wall(t);
  return new Date(t);
}

const addDays = (ymd, n) => { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const dowOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

export const fmtWhen = (at) => new Date(at).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const fmtTime = (at) => new Date(at).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
export const fmtDay = (ymd) => new Date(`${ymd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

export async function getCapacity() {
  if (!supabaseAdmin) return 2;
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "booking_capacity").maybeSingle();
  return Math.max(1, Number(data?.value) || 2);
}

// Booked count per slot start (ISO) between two instants.
async function takenMap(from, to, ignoreLeadId) {
  const map = new Map();
  if (!supabaseAdmin) return map;
  let q = supabaseAdmin.from("leads").select("id,appointment_at").gte("appointment_at", from.toISOString()).lt("appointment_at", to.toISOString()).in("appt_status", ACTIVE_APPT);
  const { data } = await q;
  (data || []).filter((r) => r.id !== ignoreLeadId).forEach((r) => { const k = new Date(r.appointment_at).toISOString(); map.set(k, (map.get(k) || 0) + 1); });
  return map;
}

/** [{ date, label, slots: [{ at, label }] }] for the next DAYS_AHEAD days, full slots left out. */
export async function openSlots({ days = DAYS_AHEAD, ignoreLeadId } = {}) {
  const now = new Date();
  const today = laParts(now).ymd;
  const cap = await getCapacity();
  const taken = await takenMap(laInstant(today, 0), laInstant(addDays(today, days + 1), 0), ignoreLeadId);
  const out = [];
  for (let i = 0; i < days; i++) {
    const ymd = addDays(today, i);
    const [open, close] = HOURS[dowOf(ymd)];
    const slots = [];
    for (let t = open; t <= close - LAST_BEFORE_CLOSE; t += STEP) {
      const at = laInstant(ymd, t);
      if (at.getTime() < now.getTime() + LEAD_MINUTES * 60000) continue;
      if ((taken.get(at.toISOString()) || 0) >= cap) continue;
      slots.push({ at: at.toISOString(), label: fmtTime(at) });
    }
    if (slots.length) out.push({ date: ymd, label: i === 0 ? `Today, ${fmtDay(ymd).split(", ")[1]}` : i === 1 ? `Tomorrow, ${fmtDay(ymd).split(", ")[1]}` : fmtDay(ymd), slots });
  }
  return out;
}

export async function isSlotOpen(at, ignoreLeadId) {
  const iso = new Date(at).toISOString();
  return (await openSlots({ ignoreLeadId })).some((d) => d.slots.some((s) => s.at === iso));
}

// Is the shop open right now (so alerts to the owner wait for business hours)?
export function shopOpenNow(d = new Date()) {
  const p = laParts(d); const [open, close] = HOURS[p.dow]; const t = p.hh * 60 + p.mm;
  return t >= open - 30 && t < close;
}

// Reminders to customers only go out 8 AM–9 PM LA time (texting quiet hours); outside that
// window the watchdog waits and sends on its first run after 8 AM.
export function customerHoursNow(d = new Date()) {
  const { hh } = laParts(d);
  return hh >= 8 && hh < 21;
}

// Calendar invite for the confirmation email.
export function icsFile({ at, minutes = 60, title, description, uid }) {
  const f = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = new Date(at), end = new Date(start.getTime() + minutes * 60000);
  const esc = (s) => String(s || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tire Plug//Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${uid}@tireplugla.com`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`, "LOCATION:The Tire Plug\\, 2331 E Olympic Blvd\\, Los Angeles\\, CA 90021",
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Tire Plug appointment", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
