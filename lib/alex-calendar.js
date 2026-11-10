/**
 * The owner's calendar (server-only). See lib/alex-schema.sql.
 * Two kinds of entries:
 *   - meetings he schedules (owner_events), optionally with a staff member who gets a text
 *   - customer appointments booked on the website (leads.appointment_at, active ones only)
 * Every entry is on the "business" or "personal" calendar (appointments are business).
 * icsFeed() turns them into iCalendar feeds his iPhone Calendar subscribes to, one per calendar.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { setting } from "./invoices.js";
import { reps } from "./commission.js";
import { ACTIVE_APPT } from "./booking.js";
import { sendSms } from "./sms.js";

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://tireplugla.com").replace(/\/$/, "");
const TZ = "America/Los_Angeles";
/** Google Maps driving directions from wherever the phone is to this place. */
export const mapsLink = (place) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}&travelmode=driving`;
const parseAlarms = (v) => String(v || "").split(",").map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 2880);

/** People he can schedule with: app_settings alex_people, plus the commission reps (Lexi, Junior) and Belen. */
export async function people() {
  let list = [];
  try { list = JSON.parse((await setting("alex_people")) || "[]"); } catch { list = []; }
  list = list.filter((p) => p && p.name).map((p) => ({ name: String(p.name), phone: p.phone || "" }));
  const has = (n) => list.some((p) => p.name.toLowerCase() === n.toLowerCase());
  for (const r of await reps().catch(() => [])) if (r.name && !has(r.name)) list.push({ name: r.name, phone: r.text_to || "" });
  if (!has("Belen")) list.push({ name: "Belen", phone: "" });
  return list;
}

export async function savePeople(list) {
  const clean = (Array.isArray(list) ? list : []).filter((p) => p && String(p.name || "").trim())
    .map((p) => ({ name: String(p.name).trim().slice(0, 40), phone: String(p.phone || "").trim().slice(0, 20) })).slice(0, 30);
  const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "alex_people", value: JSON.stringify(clean), updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export const CALENDARS = ["business", "personal"];

/** Everything between two instants, sorted; cal = "business" | "personal" | anything else for both. */
export async function entries(from, to, cal) {
  const [ev, appts] = await Promise.all([
    supabaseAdmin.from("owner_events").select("*").gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at")
      .then((r) => { if (r.error) throw new Error(`${r.error.message}. Run lib/alex-schema.sql in Supabase first.`); return r.data || []; }),
    supabaseAdmin.from("leads").select("id,name,phone,vehicle,tire_size,service,appointment_at,appt_status")
      .not("appointment_at", "is", null).gte("appointment_at", from.toISOString()).lt("appointment_at", to.toISOString()).in("appt_status", ACTIVE_APPT)
      .then((r) => r.data || []),
  ]);
  const out = [
    ...ev.map((e) => ({ kind: "meeting", calendar: e.calendar === "personal" ? "personal" : "business", id: e.id, title: e.title, at: e.starts_at, minutes: e.minutes || 30, with_name: e.with_name, place: e.place, maps: e.place ? mapsLink(e.place) : null, alarms: e.alarms ? parseAlarms(e.alarms) : [15], notes: e.notes, texted_at: e.texted_at, text_error: e.text_error })),
    ...appts.map((a) => ({ kind: "appt", calendar: "business", id: `lead-${a.id}`, lead_id: a.id, title: `${a.name || "Customer"}: ${[a.service, a.tire_size].filter(Boolean).join(" · ") || "appointment"}`, at: a.appointment_at, minutes: 60, vehicle: a.vehicle || null, status: a.appt_status })),
  ];
  return out.filter((e) => !CALENDARS.includes(cal) || e.calendar === cal).sort((x, y) => (x.at < y.at ? -1 : 1));
}

const when = (iso) => new Date(iso).toLocaleString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Save a meeting; text the person if asked and a phone is known. */
export async function addMeeting({ title, starts_at, minutes, with_name, place, notes, text, calendar, alarms }, createdBy) {
  const at = new Date(starts_at);
  if (!title || !String(title).trim()) throw new Error("Give the meeting a title.");
  if (Number.isNaN(at.getTime())) throw new Error("Pick a date and time.");
  const mins = Math.max(5, Math.min(600, parseInt(minutes, 10) || 30));
  const person = with_name ? (await people()).find((p) => p.name.toLowerCase() === String(with_name).toLowerCase()) : null;
  const row = {
    // Owner's rule (2026-11-10): any 1-on-1 meeting with a person is a personal matter.
    calendar: with_name || calendar === "personal" ? "personal" : "business",
    title: String(title).trim().slice(0, 120), starts_at: at.toISOString(), minutes: mins,
    with_name: person?.name || (with_name ? String(with_name).slice(0, 40) : null), with_phone: person?.phone || null,
    place: place ? String(place).trim().slice(0, 160) : null,
    alarms: Array.isArray(alarms) && parseAlarms(alarms.join(",")).length ? parseAlarms(alarms.join(",")).slice(0, 5).join(",") : null, notes: notes ? String(notes).trim().slice(0, 500) : null, created_by: createdBy || null,
  };
  if (text && row.with_name) {
    if (!row.with_phone) row.text_error = `No phone saved for ${row.with_name}.`;
    else {
      const body = `Hi ${row.with_name}, Alex scheduled a meeting with you: ${row.title}, ${when(row.starts_at)} (${mins} min)${row.place ? ` at ${row.place}` : ""}.${row.notes ? ` ${row.notes}` : ""} - The Tire Plug`;
      const r = await sendSms({ to: row.with_phone, body });
      if (r.ok) row.texted_at = new Date().toISOString(); else row.text_error = r.error || "Text failed.";
    }
  }
  const { error } = await supabaseAdmin.from("owner_events").insert(row);
  if (error) throw new Error(error.message);
  return row;
}

/** The iPhone calendar links (webcal://), one per calendar, from the secret key. */
export async function feedUrls() {
  const k = await setting("alex_ical_key");
  if (!k) return null;
  const base = `${SITE.replace(/^https?:/, "webcal:")}/api/alex-calendar?k=${k}`;
  return { business: `${base}&cal=business`, personal: `${base}&cal=personal` };
}

/* ---- iCalendar ---- */
const icsTime = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const fold = (line) => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ` ${s.slice(74)}`; } out.push(s); return out.join("\r\n"); };

export function icsFeed(items, name = "Tire Plug (Alex)") {
  const now = icsTime(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Tire Plug//Alex//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:America/Los_Angeles", "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M"];
  for (const e of items) {
    const end = new Date(new Date(e.at).getTime() + (e.minutes || 30) * 60000);
    const desc = e.kind === "appt" ? [e.vehicle, `${SITE}/admin`].filter(Boolean).join("\n") : [e.with_name ? `With ${e.with_name}` : "", e.notes, e.maps ? `Directions: ${e.maps}` : ""].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${e.id}@tireplugla.com`, `DTSTAMP:${now}`, `DTSTART:${icsTime(e.at)}`, `DTEND:${icsTime(end)}`,
      fold(`SUMMARY:${esc(e.kind === "appt" ? `🛞 ${e.title}` : e.with_name ? `${e.title} (${e.with_name})` : e.title)}`));
    if (desc) lines.push(fold(`DESCRIPTION:${esc(desc)}`));
    if (e.place || e.calendar !== "personal") lines.push(fold(`LOCATION:${esc(e.place || "The Tire Plug, 2331 E Olympic Blvd, Los Angeles, CA 90021")}`));
    if (e.maps) lines.push(fold(`URL:${e.maps}`));
    if (e.kind === "meeting") for (const m of e.alarms || [15]) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", fold(`DESCRIPTION:${esc(m ? `${e.title} in ${m >= 60 && m % 60 === 0 ? `${m / 60} hr` : `${m} min`}` : `Now: ${e.title}`)}`), `TRIGGER:-PT${m}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
