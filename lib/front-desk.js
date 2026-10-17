/**
 * Front Desk agent: makes sure no website lead or appointment falls through.
 *
 *  - every new lead/booking: owner alert (text + email), customer confirmation (email with a
 *    calendar invite; a text too if they ticked SMS consent)
 *  - watchdog (every 5 min via Supabase pg_cron, daily via Vercel as a backup, and whenever
 *    the Front Desk screen is open): re-alerts the owner about unanswered leads during shop
 *    hours, sends the 24h and 2h reminders, flags tires to order and possible no-shows
 *  - every action is logged to front_desk_events, which the Front Desk screen shows
 *
 * Env: ADMIN_ALERT_EMAIL, ADMIN_ALERT_PHONE (owner alerts, comma-separated lists), RESEND_*, TWILIO_*.
 */
import crypto from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin.js";
import { sendSms } from "./sms.js";
import { renderNotice, sendOne, firstName, SITE, BRAND } from "./email.js";
import { fmtWhen, fmtTime, icsFile, shopOpenNow, customerHoursNow, laParts, laInstant } from "./booking.js";

// Owner alerts go to every address/number listed (comma-separated, e.g. "562-111-2222, 562-333-4444").
// No phone set = no text alerts: the shop's own Twilio number can't text itself.
const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);
export const OWNER_EMAILS = list(process.env.ADMIN_ALERT_EMAIL || "alejandro.l@tirexchange.org");
export const OWNER_PHONES = list(process.env.ADMIN_ALERT_PHONE);
export const OWNER_EMAIL = OWNER_EMAILS[0]; // first address, for single-recipient reports
const MAP_URL = "https://maps.google.com/?q=2331+E+Olympic+Blvd+Los+Angeles+CA+90021";
const NAG_MINUTES = [10, 30, 120];

export const manageUrl = (token) => `${SITE}/appointment/${token}`;
export const newToken = () => crypto.randomBytes(18).toString("base64url");
const smsOk = (lead) => !!(lead.phone && lead.raw && lead.raw.smsConsent === true);
const needsTires = (lead) => /new tires|used tires/i.test(lead.service || "");
const who = (lead) => `${lead.name || "Someone"}${lead.vehicle ? ` · ${lead.vehicle}` : ""}`;
// Tire order details from the /book page, e.g. { quantity: 4, price: 81, text: "x4 @ $81/tire" }.
export function orderInfo(lead) {
  const q = Number(lead.raw?.quantity) || null, p = Number(lead.raw?.price) || null;
  return { quantity: q, price: p, text: [q && `x${q}`, p && `@ $${p}/tire`].filter(Boolean).join(" ") };
}
const tireName = (l) => (l.tire_type && !/^(N\/A|Budget|Mid-range|Premium|Not sure)$/i.test(l.tire_type) ? `${l.tire_type} ` : "");

/* ---------------- event log ---------------- */
export async function logEvent(leadId, type, message, key) {
  const { error } = await supabaseAdmin.from("front_desk_events").insert({ lead_id: leadId || null, type, message, key: key || null });
  return !error; // false when `key` already exists: that action already happened
}
// Claim a one-time action before doing it, so two watchdog runs can't both send it.
async function once(key, leadId, type, message, fn) {
  if (!(await logEvent(leadId, type, message, key))) return false;
  try { await fn(); } catch (e) { console.error(`front-desk ${key}:`, e); }
  return true;
}

/* ---------------- owner alerts ---------------- */
export async function alertOwner(subject, text, { link } = {}) {
  // Each recipient separately, so one bad number or address doesn't block the rest.
  if (!OWNER_PHONES.length) console.warn("front-desk: ADMIN_ALERT_PHONE not set, skipping text alert");
  const tasks = OWNER_PHONES.map((to) => sendSms({ to, body: `Tire Plug: ${text}${link ? ` ${link}` : ""}` }));
  if (process.env.RESEND_API_KEY) {
    for (const to of OWNER_EMAILS) tasks.push(sendOne({
      to, subject, transactional: true, tags: { kind: "owner_alert" }, text: `${text}\n\n${link || `${SITE}/admin`}`,
      html: renderNotice({ headline: subject, message: text, buttons: [{ label: "Open Front Desk", href: link || `${SITE}/admin` }] }),
    }));
  }
  await Promise.allSettled(tasks);
}

/* ---------------- customer messages ---------------- */
// Every email in the booking sequence, in one place: real sends and the samples use these.
export const BOOKING_EMAILS = {
  confirmation: (l, { rescheduled = false } = {}) => ({
    subject: rescheduled ? `New time confirmed: ${fmtWhen(l.appointment_at)}` : `You're booked: ${fmtWhen(l.appointment_at)}`,
    headline: rescheduled ? "Your new time is confirmed" : "You're booked!",
    message: `Hi ${firstName(l.name)},\n\n${rescheduled ? "Your appointment has been moved." : "Thanks for booking with The Tire Plug."} Here are your details. A calendar invite is attached.`,
    withInvite: true,
  }),
  dayBefore: (l) => {
    const day = laParts(new Date(l.appointment_at)).ymd === laParts().ymd ? "today" : "tomorrow";
    return { subject: `Reminder: ${fmtWhen(l.appointment_at)} at The Tire Plug`, headline: `See you ${day}!`, message: `Hi ${firstName(l.name)},\n\nJust a reminder about your appointment ${day}. If the time doesn't work anymore, you can change it in one tap below.` };
  },
  twoHour: (l) => ({ subject: `Today at ${fmtTime(l.appointment_at)}: The Tire Plug`, headline: "See you soon!", message: `Hi ${firstName(l.name)},\n\nYour appointment is today at ${fmtTime(l.appointment_at)}. Running late? Just call us.` }),
  noShow: (l) => ({ subject: "We missed you today", headline: "We missed you!", message: `Hi ${firstName(l.name)},\n\nWe had you down for today and didn't see you. No problem — pick a new time below or give us a call.` }),
};

async function reviewUrl() {
  const { data } = await supabaseAdmin.from("app_settings").select("key,value").in("key", ["review_url_olympic", "google_review_url"]);
  return (data || []).find((r) => r.key === "review_url_olympic")?.value || (data || []).find((r) => r.key === "google_review_url")?.value || null;
}
function thankYouEmail(lead, review) {
  return {
    subject: "Thanks for coming in!",
    text: `Thanks for choosing The Tire Plug!${review ? `\n\nLeave a review: ${review}` : ""}`,
    html: renderNotice({ headline: "Thanks for coming in!", message: `Hi ${firstName(lead.name)},\n\nThanks for choosing The Tire Plug.${needsTires(lead) ? " Your new tires come with free repairs for 365 days — just stop by if you pick up a nail." : ""}${review ? "\n\nIf we did right by you, a quick Google review means a lot to a local shop." : ""}`, buttons: review ? [{ label: "Leave a review", href: review }] : [] }),
  };
}

async function emailCustomer(lead, { subject, headline, message, withInvite }) {
  if (!lead.email || !process.env.RESEND_API_KEY) return false;
  const at = lead.appointment_at;
  const attachments = withInvite ? [{ filename: "tire-plug-appointment.ics", content: Buffer.from(icsFile({
    at, uid: `${lead.id}-${new Date(at).getTime()}`, title: "The Tire Plug appointment",
    description: `${lead.service || "Service"}${lead.vehicle ? ` for your ${lead.vehicle}` : ""}. Questions: ${BRAND.phone}. Change or cancel: ${manageUrl(lead.appt_token)}`,
  })).toString("base64") }] : undefined;
  const out = await sendOne({
    to: lead.email, subject, transactional: true, attachments, tags: { kind: "appointment" },
    text: `${message}\n\nWhen: ${fmtWhen(at)}\nWhere: ${BRAND.address}\nChange or cancel: ${manageUrl(lead.appt_token)}\n${BRAND.phone}`,
    html: renderNotice({
      headline, message,
      details: [["When", fmtWhen(at)], ["Service", lead.service], ["Vehicle", lead.vehicle], ["Tire size", lead.tire_size && !/help me/i.test(lead.tire_size) ? lead.tire_size : null], ["Where", BRAND.address]],
      buttons: [{ label: "Get directions", href: MAP_URL }, { label: "Change or cancel", href: manageUrl(lead.appt_token) }],
      footerNote: "Running late or need help? Call or text us anytime.",
    }),
  });
  return out.sent > 0;
}

async function textCustomer(lead, body) {
  if (!smsOk(lead)) return false;
  const r = await sendSms({ to: lead.phone, body });
  if (r.ok) {
    await supabaseAdmin.from("lead_messages").insert({ lead_id: lead.id, direction: "outbound", phone: String(lead.phone).replace(/\D/g, "").slice(-10), body, twilio_sid: r.sid, status: r.status, read: true });
  }
  return r.ok;
}

export async function sendConfirmation(lead, { rescheduled = false } = {}) {
  const when = fmtWhen(lead.appointment_at);
  const [e, t] = await Promise.all([
    emailCustomer(lead, BOOKING_EMAILS.confirmation(lead, { rescheduled })),
    textCustomer(lead, `${rescheduled ? "Your new time is confirmed" : "You're booked"} at The Tire Plug: ${when}${lead.service ? ` for ${lead.service}` : ""}. 2331 E Olympic Blvd. Change or cancel: ${manageUrl(lead.appt_token)} Reply STOP to opt out.`),
  ]);
  const how = [e && "email", t && "text"].filter(Boolean).join(" + ");
  await logEvent(lead.id, "confirmation", how ? `Confirmation sent to ${who(lead)} by ${how}` : `${who(lead)} has no email or text consent: call to confirm`);
  return { email: e, text: t };
}

/* ---------------- intake (called by /api/submit-booking) ---------------- */
export async function onNewLead(lead) {
  try {
    const hot = /ASAP|Tomorrow/i.test(lead.service_timing || "");
    if (lead.appointment_at) {
      await logEvent(lead.id, "booked", `${who(lead)} booked ${fmtWhen(lead.appointment_at)} — ${lead.service || "service"}`);
      const sent = await sendConfirmation(lead);
      const order = orderInfo(lead).text;
      const tires = needsTires(lead) ? ` Tires to get: ${tireName(lead)}${lead.tire_size || "size unknown"}${order ? ` ${order}` : ""}.` : "";
      await alertOwner(`📅 New booking: ${fmtWhen(lead.appointment_at)}`,
        `New booking ${fmtWhen(lead.appointment_at)}: ${who(lead)}, ${lead.service || "service"}.${tires} ${lead.phone || ""}${!sent.email && !sent.text ? " No email/text consent: call to confirm." : ""}`.trim());
    } else {
      await logEvent(lead.id, "new_lead", `New ${hot ? "HOT " : ""}lead: ${who(lead)} — ${lead.service || "quote"} (${lead.service_timing || "no timing"})`);
      await alertOwner(`${hot ? "🔥" : "🆕"} New lead: ${lead.name || "website"}`,
        `${hot ? "HOT lead, call now" : "New lead"}: ${who(lead)}, ${lead.service || "quote"}${lead.tire_size ? `, ${lead.tire_size}` : ""} (${lead.service_timing || "no timing"}). ${lead.phone || ""}`.trim());
    }
  } catch (e) {
    console.error("Front desk intake error (non-blocking):", e);
  }
}

/* ---------------- watchdog ---------------- */
export async function runWatchdog() {
  const now = Date.now();
  const report = { nagged: 0, reminders: 0, tireAlerts: 0, noShows: 0 };
  // Timing rules: owner alerts from the watchdog wait for shop hours (new bookings and
  // cancellations still alert instantly, from intake); customer reminders only 8 AM–9 PM.
  // Anything held back goes out on the first run once the window opens.
  const ownerHours = shopOpenNow(), customerHours = customerHoursNow();

  // 1) Leads nobody has answered. A booking the customer canceled online needs no reply.
  if (ownerHours) {
    const { data: open } = await supabaseAdmin.from("leads").select("id,name,phone,vehicle,service,service_timing,created_at")
      .eq("status", "new").is("first_response_at", null).or("appt_status.is.null,appt_status.neq.canceled")
      .gte("created_at", new Date(now - 3 * 864e5).toISOString());
    for (const l of open || []) {
      const mins = Math.floor((now - new Date(l.created_at).getTime()) / 60000);
      const level = NAG_MINUTES.filter((m) => mins >= m).length;
      if (!level) continue;
      const msg = `⏰ ${l.name || "A lead"} has waited ${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`} with no reply: ${l.service || "quote"}. ${l.phone || ""}`.trim();
      if (await once(`nag${level}:${l.id}`, l.id, "alert", msg, () => alertOwner(`⏰ Unanswered lead: ${l.name || "website"}`, msg))) report.nagged++;
    }
  }

  // 2) Appointments in the next ~day (and just past, for no-shows).
  const { data: appts } = await supabaseAdmin.from("leads").select("*").eq("appt_status", "confirmed")
    .gte("appointment_at", new Date(now - 6 * 3600e3).toISOString()).lte("appointment_at", new Date(now + 31 * 3600e3).toISOString());
  for (const l of appts || []) {
    const at = new Date(l.appointment_at).getTime(), until = at - now, k = `${l.id}:${at}`;
    const bookedLongAgo = !l.appt_booked_at || now - new Date(l.appt_booked_at).getTime() > 3 * 3600e3;

    if (customerHours && until <= 24 * 3600e3 && until > 3 * 3600e3 && bookedLongAgo) {
      const day = laParts(new Date(at)).ymd === laParts().ymd ? "today" : "tomorrow";
      if (await once(`rem24:${k}`, l.id, "reminder", `Day-before reminder sent to ${who(l)}`, () => Promise.all([
        emailCustomer(l, BOOKING_EMAILS.dayBefore(l)),
        textCustomer(l, `Reminder: your Tire Plug appointment is ${day}, ${fmtWhen(at)}. Need to change it? ${manageUrl(l.appt_token)}`),
      ]))) report.reminders++;
    }
    if (customerHours && until <= 2.5 * 3600e3 && until > 15 * 60e3 && now - new Date(l.appt_booked_at || 0).getTime() > 3600e3) {
      if (await once(`rem2:${k}`, l.id, "reminder", `2-hour reminder sent to ${who(l)}`, () => Promise.all([
        textCustomer(l, `See you soon! Your Tire Plug appointment is today at ${fmtTime(at)}, 2331 E Olympic Blvd. Running late? Call ${BRAND.phone}.`),
        smsOk(l) ? null : emailCustomer(l, BOOKING_EMAILS.twoHour(l)),
      ]))) report.reminders++;
    }
    if (ownerHours && needsTires(l) && !l.tires_ordered_at && until <= 30 * 3600e3 && until > 0) {
      const order = orderInfo(l).text;
      const msg = `🛞 Order tires for ${who(l)}: ${tireName(l)}${l.tire_size || "size unknown, call them"}${order ? ` ${order}` : ""}, appointment ${fmtWhen(at)}.`;
      if (await once(`tires:${k}`, l.id, "alert", msg, () => alertOwner(`🛞 Tires to order for ${fmtWhen(at)}`, msg))) report.tireAlerts++;
    }
    if (ownerHours && until < -45 * 60e3) {
      const msg = `❓ ${who(l)} was due at ${fmtTime(at)} and hasn't been checked in. Did they show?`;
      if (await once(`noshow:${k}`, l.id, "no_show", msg, () => alertOwner(`❓ Possible no-show: ${l.name || "customer"}`, msg))) report.noShows++;
    }
  }

  await supabaseAdmin.from("app_settings").upsert({ key: "front_desk_last_run", value: new Date().toISOString() }, { onConflict: "key" });
  return report;
}

/* ---------------- owner actions ---------------- */
export async function sendNoShowFollowup(lead) {
  await Promise.all([
    textCustomer(lead, `Hi ${firstName(lead.name)}, we missed you today at The Tire Plug! Want to pick a new time? ${manageUrl(lead.appt_token)} Or call ${BRAND.phone}.`),
    emailCustomer(lead, BOOKING_EMAILS.noShow(lead)),
  ]);
}

export async function sendThankYou(lead) {
  const review = await reviewUrl();
  const text = `Thanks for choosing The Tire Plug, ${firstName(lead.name)}!${review ? ` If we did right by you, a quick Google review helps a lot: ${review}` : ""} Reply STOP to opt out.`;
  await textCustomer(lead, text);
  if (lead.email && process.env.RESEND_API_KEY) {
    await sendOne({ to: lead.email, transactional: true, tags: { kind: "thank_you" }, ...thankYouEmail(lead, review) });
  }
}

/* ---------------- samples ---------------- */
// The 5 customer emails of the booking sequence, sent to `to` as "[Sample n/5]", for a made-up
// customer with an appointment tomorrow at 10 AM. Email only (no texts), nothing saved, no alerts.
export async function sendSampleEmails(to) {
  const ymd = laParts(new Date(Date.now() + 864e5)).ymd;
  const lead = {
    id: "sample", name: "Maria Lopez", email: to, phone: null, raw: {}, appt_token: "sample",
    service: "New Tires: Goodyear Assurance Finesse 225/65R17 x4", vehicle: "2019 Toyota RAV4", tire_size: "225/65R17",
    appointment_at: laInstant(ymd, 600).toISOString(),
  };
  const steps = [
    ["Booking confirmation, sent right away", BOOKING_EMAILS.confirmation(lead)],
    ["Day-before reminder", BOOKING_EMAILS.dayBefore(lead)],
    ["2-hour reminder (only when they didn't allow texts)", BOOKING_EMAILS.twoHour(lead)],
    ["No-show, after a rep taps No-show", BOOKING_EMAILS.noShow(lead)],
  ];
  let sent = 0;
  for (const [i, [what, m]] of steps.entries()) {
    if (await emailCustomer(lead, { ...m, subject: `[Sample ${i + 1}/5: ${what}] ${m.subject}` })) sent++;
  }
  const ty = thankYouEmail(lead, await reviewUrl());
  const out = await sendOne({ to, transactional: true, tags: { kind: "sample" }, ...ty, subject: `[Sample 5/5: Thank-you, after a rep taps Done] ${ty.subject}` });
  return sent + (out.sent || 0);
}
