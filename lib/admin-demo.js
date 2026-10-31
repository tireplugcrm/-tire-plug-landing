// Sample shop for the admin demo (/admin-demo, local only): leads, bookings, texts and stock for
// training videos and practice, with the same answers the real /api/admin/* routes give. Kept in
// memory on the dev server; "reset" starts over. No Supabase, GoHighLevel or Tekmetric is touched.
import { shelfTires } from "./inventory.js";

const TZ = "America/Los_Angeles";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const mins = (m) => new Date(Date.now() + m * 60000).toISOString();
// The next half hour at least `m` minutes from now (bookings sit on :00 / :30).
const slot = (m) => { const t = Date.now() + m * 60000; return new Date(Math.ceil(t / 1800000) * 1800000).toISOString(); };
const tomorrowAt = (h, mm = 0) => {
  const d = new Date(Date.now() + 864e5);
  const la = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const off = d.getTime() - la.getTime();
  la.setHours(h, mm, 0, 0);
  return new Date(la.getTime() + off).toISOString();
};

export function adminDemoSeed() {
  const lead = (id, f) => ({
    id, status: "new", channel: "web", source: "Website Booking Form", lead_priority: "WARM", quotes: [], services: {},
    created_at: mins(-f.age), first_response_at: null, quoted_at: null, last_reply_at: null, appointment_at: null, appt_status: null,
    contactable: true, availability: "in_stock", email: "", notes: "", ...f,
  });
  const leads = [
    lead("d1", { age: 4, name: "Maria Gonzalez", phone: "5625550101", vehicle: "2018 Honda Civic", tire_size: "215/55R16", service: "New tires", tire_type: "All-season", service_timing: "This week", lead_priority: "HOT", price: 89, quantity: 4 }),
    lead("d2", { age: 26, name: "Kevin Tran", phone: "5625550102", vehicle: "2016 Toyota Tacoma", tire_size: "265/70R17", service: "New tires", tire_type: "All-terrain", service_timing: "Today", lead_priority: "HOT" }),
    lead("d3", { age: 12, name: "Dani Ruiz", phone: "", channel: "instagram", source: "Instagram DM", vehicle: "2019 Ford Mustang", tire_size: "255/40R19", service: "New tires", tire_type: "Performance" }),
    lead("d4", { age: 180, name: "Chris Walker", phone: "5625550104", vehicle: "2014 Chevy Silverado", tire_size: "275/55R20", service: "New tires", status: "called", first_response_at: mins(-170) }),
    lead("d5", { age: 300, name: "Ana Perez", phone: "5625550105", vehicle: "2021 Tesla Model 3", tire_size: "235/45R18", service: "Flat repair", status: "called", first_response_at: mins(-290) }),
    lead("d6", { age: 1500, name: "Luis Ramirez", phone: "5625550106", vehicle: "2017 Honda Accord", tire_size: "225/50R17", service: "New tires", first_response_at: mins(-1490), quoted_at: mins(-1480),
      quotes: [{ brand: "Arroyo Grand Sport A/S", price: 92, qty: 4, warranty: "50,000 mi" }, { brand: "Falken Sincera SN250", price: 118, qty: 4, warranty: "65,000 mi" }] }),
    lead("d7", { age: 2900, name: "Jenny Lee", phone: "5625550107", vehicle: "2020 Toyota RAV4", tire_size: "225/65R17", service: "New tires", first_response_at: mins(-2880), quoted_at: mins(-2870),
      quotes: [{ brand: "BFGoodrich Advantage Control", price: 139, qty: 4, warranty: "70,000 mi" }] }),
    lead("d8", { age: 900, name: "Marco Diaz", phone: "5625550108", vehicle: "2013 Ford Mustang", tire_size: "255/40R19", service: "New tires", first_response_at: mins(-880), appointment_at: slot(95), appt_status: "confirmed", price: 145, quantity: 2, availability: "next_day" }),
    lead("d9", { age: 700, name: "Priya Shah", phone: "5625550109", vehicle: "2019 Hyundai Elantra", tire_size: "205/55R16", service: "Alignment", first_response_at: mins(-690), appointment_at: slot(160), appt_status: "confirmed", contactable: false }),
    lead("d10", { age: 1300, name: "Ray Walker", phone: "5625550110", vehicle: "2016 Chevy Tahoe", tire_size: "265/70R17", service: "New tires", first_response_at: mins(-1290), appointment_at: tomorrowAt(10), appt_status: "confirmed", price: 129, quantity: 4 }),
    lead("d11", { age: 4000, name: "Sam Wilson", phone: "5625550111", vehicle: "2014 Mazda 3", tire_size: "205/60R16", service: "New tires", status: "booked", first_response_at: mins(-3990), appt_status: "done", revenue_amount: 420 }),
    lead("d12", { age: 6000, name: "Tom Harris", phone: "5625550112", vehicle: "2020 Nissan Altima", tire_size: "235/40R19", service: "New tires", status: "dead", first_response_at: mins(-5990) }),
  ];
  const msg = (lead_id, direction, body, age, status = "sent") => ({ id: `m${lead_id}${age}${direction[0]}`, lead_id, direction, body, created_at: mins(-age), status });
  const messages = [
    msg("d1", "inbound", "Hi, do you have 215/55R16 in stock? Need 4.", 4),
    msg("d2", "inbound", "Need 4 all terrain 265/70R17 for my Tacoma today if possible", 26),
    msg("d3", "inbound", "how much for 2 tires 255/40R19?", 12),
    msg("d4", "outbound", "Hi Chris, it's The Tire Plug. We have 275/55R20 in stock. Want me to send prices?", 170),
    msg("d4", "inbound", "Yes please, what brands?", 160),
    msg("d6", "outbound", "Hi Luis, here's your tire quote from The Tire Plug:\nArroyo Grand Sport A/S - $92 each (set of 4 = $368)\nFalken Sincera SN250 - $118 each (set of 4 = $472)", 1480),
    msg("d7", "outbound", "Hi Jenny, BFGoodrich Advantage Control 225/65R17 - $139 each (set of 4 = $556), 70,000 mi warranty.", 2870),
    msg("d8", "outbound", "You're booked! See you today. Your next-day tires are on the way.", 880),
  ];
  const texts = [
    { phone: "5625550199", name: null, body: "Are you guys open Sunday?", age: 40 },
  ];
  return {
    leads, messages, texts,
    reminders: [{ id: "r1", lead_id: "d6", due_at: mins(-60), note: "Check if he wants the Falkens", kind: "general", done: false }],
    events: [
      { id: "e1", type: "new_lead", message: "New website lead: Maria Gonzalez · 215/55R16", created_at: mins(-4), lead_id: "d1" },
      { id: "e2", type: "alert", message: "Kevin Tran has waited 25 min for a reply", created_at: mins(-1), lead_id: "d2" },
      { id: "e3", type: "booked", message: "Marco Diaz booked online · 2 × 255/40R19 (next-day)", created_at: mins(-880), lead_id: "d8" },
      { id: "e4", type: "confirmation", message: "Confirmation sent to Ray Walker", created_at: mins(-1290), lead_id: "d10" },
    ],
    capacity: 2,
  };
}

// The Front Desk board, worked out from the sample leads like /api/admin/front-desk does.
function board(shop) {
  const today = dayKey(new Date());
  const appointments = shop.leads.filter((l) => l.appointment_at).sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  const unanswered = shop.leads.filter((l) => l.status === "new" && !l.first_response_at && l.appt_status !== "canceled").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const nowHour = Number(new Date().toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }));
  const todays = appointments.filter((a) => dayKey(a.appointment_at) === today && a.appt_status !== "canceled");
  const hourOf = (s) => Number(new Date(s).toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }));
  const byHour = Array.from({ length: 11 }, (_, i) => 9 + i).map((h) => ({ h, cars: h < nowHour ? [2, 3, 1, 2, 3, 2, 1, 2, 1, 1, 0][h - 9] : 0, booked: todays.filter((a) => hourOf(a.appointment_at) === h).length }));
  return {
    today, appointments, unanswered, lastRun: mins(-2), capacity: shop.capacity, events: shop.events,
    alerts: { phones: ["(562) 250-3737"], emails: ["shop@tireplugla.com"], smsOn: true, emailOn: true },
    home: {
      carsToday: byHour.reduce((n, b) => n + b.cars, 0), carsWeek: [9, 12, 8, 14, 11, 13, 10], bookedToday: todays.length, bookingsWeek: [3, 5, 2, 6, 4, 5, 3],
      tiresOnShelf: 412, tiresLow: 9, byHour, nowHour,
      next: todays.filter((a) => a.appt_status === "confirmed").map((a) => ({ kind: "appt", lead_id: a.id, at: a.appointment_at, name: a.name, vehicle: a.vehicle, what: [a.service, a.tire_size].filter(Boolean).join(" · "), status: "booked" })),
    },
  };
}

const phone10 = (p) => String(p || "").replace(/\D/g, "").slice(-10);

// Sample prices for the Inventory screen (the real ones come from Supabase): round, believable,
// by rim size. Only the selling price is shown, as staff see it.
async function pricing() {
  const tires = await shelfTires().catch(() => []);
  const rim = (k) => Number((String(k).match(/R(\d{2})/) || [])[1]) || 17;
  const rows = tires.slice(0, 400).map((t, i) => {
    const price = t.price ?? Math.round((55 + (rim(t.key) - 14) * 18 + (i % 5) * 9) / 1) ;
    return { id: `t${i}`, brand: t.brand, model: t.model, key: t.key, lt: false, level: t.level === "low" ? "low" : "in", source: "markup", price, flags: [], held: null, slug: String(t.key).toLowerCase().replace(/\//g, "-") };
  });
  return {
    canEdit: false, rows, attention: { held: 0, belowCost: 0, lowProfit: 0, noCost: 0 }, rules: [], drafts: null, publishes: [],
    settings: { live: true, markup: 20, minProfit: 10, maxJumpPct: 15, rounding: "none" },
    health: { stockSource: "tekmetric-csv", stockSyncedAt: mins(-180), autopilot: { at: mins(-4), ok: true }, pagesQueued: 0, mismatches: 0, tekmetric: false },
  };
}

// One /api/admin/<route> call against the sample shop.
export async function adminDemo(shop, route, body = {}) {
  const lead = (id) => shop.leads.find((l) => l.id === id);
  const respond = (l) => { if (l && !l.first_response_at) { l.first_response_at = new Date().toISOString(); if (l.status === "new") l.status = "called"; } };
  switch (route) {
    case "data":
      return {
        leads: shop.leads, reminders: shop.reminders, subscribers: [], campaigns: [], replies: [], team: [],
        unreadByLead: Object.fromEntries(shop.leads.filter((l) => l.status === "new" && !l.first_response_at).map((l) => [l.id, 1])),
        me: { name: "Jordan Rep", email: "jordan@tireplugla.com", isOwner: false },
      };
    case "front-desk": {
      const l = lead(body.id);
      if (body.action === "handled") respond(l);
      if (body.action === "slots") {
        const days = [0, 1, 2].map((n) => { const base = n === 0 ? slot(90) : tomorrowAt(9); const start = new Date(base).getTime() + (n > 1 ? 864e5 : 0);
          return { date: dayKey(start), label: new Date(start).toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "short", day: "numeric" }),
            slots: Array.from({ length: 6 }, (_, i) => { const at = new Date(start + i * 1800000).toISOString(); return { at, label: new Date(at).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) }; }) }; });
        return { days };
      }
      if (body.action === "reschedule" && l) { l.appointment_at = body.at; shop.events.unshift({ id: `e${Date.now()}`, type: "rescheduled", message: `${l.name} moved to a new time`, created_at: new Date().toISOString(), lead_id: l.id }); }
      if (body.action === "cancel" && l) l.appt_status = "canceled";
      if (body.action === "no_show" && l) l.appt_status = "no_show";
      if (body.action === "resend" && l) shop.events.unshift({ id: `e${Date.now()}`, type: "confirmation", message: `Confirmation re-sent to ${l.name}`, created_at: new Date().toISOString(), lead_id: l.id });
      return board(shop);
    }
    case "update-lead": {
      const l = lead(body.id);
      if (l) { const { accessToken, password, table, id, ...patch } = body; Object.assign(l, patch); if (patch.quotes?.some((q) => q.price)) l.quoted_at = l.quoted_at || new Date().toISOString(); }
      return { ok: true };
    }
    case "reminders":
      if (body.action === "create") shop.reminders.push({ id: `r${Date.now()}`, lead_id: body.lead_id, due_at: body.due_at, note: body.note, kind: body.kind, done: false });
      if (body.action === "complete") shop.reminders = shop.reminders.map((r) => (r.id === body.id ? { ...r, done: true } : r));
      return { ok: true };
    case "lead-messages":
      return { messages: shop.messages.filter((m) => m.lead_id === body.lead_id) };
    case "send-sms":
    case "send-ig": {
      const l = lead(body.lead_id);
      shop.messages.push({ id: `m${Date.now()}`, lead_id: body.lead_id, direction: "outbound", body: body.body, created_at: new Date().toISOString(), status: "sent" });
      respond(l);
      if (body.startFollowups) [30, 240, 720].forEach((m) => shop.messages.push({ id: `f${Date.now()}${m}`, lead_id: body.lead_id, direction: "outbound", body: "follow-up", created_at: mins(m), status: "scheduled" }));
      return { ok: true };
    }
    case "ai-compose": {
      const l = lead(body.lead_id) || {};
      const first = (l.name || "there").split(" ")[0];
      if (body.mode === "quote") {
        const lines = (body.quotes || []).filter((q) => q.brand && q.price).map((q) => `${q.brand} - $${q.price} each (set of ${q.qty || 4} = $${q.price * (q.qty || 4)})${q.warranty ? `, ${q.warranty} warranty` : ""}`);
        return { draft: `Hi ${first}, here's your quote from The Tire Plug for ${l.tire_size || "your tires"}:\n${lines.join("\n")}\nInstall & balance from $25 per wheel. Want me to book you a time?` };
      }
      if (body.mode === "ready") return { draft: `Hi ${first}, your tires are in at The Tire Plug! What day and time works best to put them on?` };
      return { draft: `Hi ${first}, this is The Tire Plug. Yes, we have ${l.tire_size || "that size"} in stock. All our prices, brands and warranties are posted at tireplugla.com. Want me to book you a time today?` };
    }
    case "texts": {
      const threads = new Map();
      for (const l of shop.leads) {
        const ms = shop.messages.filter((m) => m.lead_id === l.id && m.status === "sent");
        if (l.channel === "instagram" || !l.phone || !ms.length) continue;
        threads.set(phone10(l.phone), { phone: phone10(l.phone), name: l.name, lead: { id: l.id }, messages: ms });
      }
      for (const t of shop.texts) {
        const cur = threads.get(t.phone) || { phone: t.phone, name: t.name, lead: null, messages: [] };
        cur.messages.push({ id: `x${t.phone}${t.age}`, direction: t.direction || "inbound", body: t.body, created_at: t.created_at || mins(-t.age) });
        threads.set(t.phone, cur);
      }
      if (body.action === "send") { shop.texts.push({ phone: phone10(body.phone), name: null, body: body.body, direction: "outbound", created_at: new Date().toISOString() }); const l = shop.leads.find((x) => phone10(x.phone) === phone10(body.phone)); respond(l); return { ok: true }; }
      if (body.action === "thread") {
        const t = threads.get(phone10(body.phone)) || { phone: phone10(body.phone), lead: null, messages: [] };
        return { ...t, messages: [...t.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)) };
      }
      const list = [...threads.values()].map((t) => {
        const ms = [...t.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), last = ms.at(-1);
        const l = t.lead && lead(t.lead.id);
        return { phone: t.phone, name: t.name, last: last.body, last_at: last.created_at, last_dir: last.direction, unread: last.direction === "inbound" && !(l && l.first_response_at) ? 1 : 0 };
      }).sort((a, b) => b.last_at.localeCompare(a.last_at));
      return { threads: list, isOwner: false };
    }
    case "pricing":
      return pricing();
    case "heartbeat":
    case "request-access":
      return { ok: true, status: "approved" };
    default:
      return {};
  }
}
