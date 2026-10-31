// Shop Floor: the stages a job moves through, the kinds of work, and why a job can be on hold.
// Shared by the admin board, the TV display and the API (no server-only imports here).

export const STAGES = [
  { k: "waiting", l: "Checked in", icon: "login", c: "#d97706" },
  { k: "in_bay", l: "In bay", icon: "build", c: "#2563eb" },
  { k: "on_hold", l: "On hold", icon: "pause_circle", c: "#dc2626" },
  { k: "done", l: "Ready for pickup", icon: "check_circle", c: "#16a34a" },
];
export const STAGE_KEYS = STAGES.map((s) => s.k);

export const JOB_TYPES = [
  { k: "tires", l: "New tires", icon: "tire_repair" },
  { k: "used", l: "Used tires", icon: "recycling" },
  { k: "repair", l: "Flat repair", icon: "build_circle" },
  { k: "alignment", l: "Alignment", icon: "straighten" },
  { k: "rotate", l: "Rotate & balance", icon: "autorenew" },
  { k: "tpms", l: "TPMS", icon: "sensors" },
  { k: "wheels", l: "Wheels", icon: "trip_origin" },
  { k: "other", l: "Other", icon: "more_horiz" },
];
export const JOB_TYPE_KEYS = JOB_TYPES.map((j) => j.k);

export const HOLD_REASONS = [
  { k: "approval", l: "Waiting on customer approval" },
  { k: "parts", l: "Waiting on tires" },
  { k: "customer", l: "Customer stepped out" },
  { k: "other", l: "Other" },
];
export const HOLD_KEYS = HOLD_REASONS.map((h) => h.k);

export const PARTS = [
  { k: "na", l: "No tires to order" },
  { k: "in_stock", l: "In stock" },
  { k: "ordered", l: "Ordered" },
  { k: "arrived", l: "Arrived" },
];
export const PARTS_KEYS = PARTS.map((p) => p.k);

export const BAYS = ["1", "2", "3", "4", "Alignment rack", "Outside"];
export const bayLabel = (b) => (/^\d+$/.test(String(b)) ? `Bay ${b}` : b);

// When a job has sat too long in a stage, the board and TV turn its timer amber, then red.
export const SLOW_MINS = { waiting: [20, 40], in_bay: [60, 90], on_hold: [15, 30], done: [30, 60] };

// The time a job entered its current stage.
export function stageSince(o) {
  if (o.status === "done") return o.done_at || o.created_at;
  if (o.status === "on_hold") return o.hold_since || o.started_at || o.created_at;
  if (o.status === "in_bay") return o.started_at || o.created_at;
  return o.created_at;
}
export function minsSince(iso, now = Date.now()) {
  return iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0;
}
export function fmtMins(m) {
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
// "ok" | "slow" | "late"
export function timerLevel(o, now = Date.now()) {
  const [slow, late] = SLOW_MINS[o.status] || [999, 999];
  const m = minsSince(stageSince(o), now);
  if (o.promised_at && o.status !== "done" && new Date(o.promised_at).getTime() < now) return "late";
  return m >= late ? "late" : m >= slow ? "slow" : "ok";
}

// Jobs in board order: rush first, then waiters, then oldest in the stage.
export function sortJobs(list) {
  return [...list].sort((a, b) =>
    (b.rush ? 1 : 0) - (a.rush ? 1 : 0) ||
    (b.waiter ? 1 : 0) - (a.waiter ? 1 : 0) ||
    new Date(stageSince(a)) - new Date(stageSince(b)));
}

// Today's numbers for managers: how many are done and where the time goes (minutes).
export function floorStats(orders, todayDone, now = Date.now()) {
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const span = (a, b) => (a && b ? (new Date(b) - new Date(a)) / 60000 : null);
  const done = todayDone || [];
  return {
    active: orders.filter((o) => o.status !== "done").length,
    ready: orders.filter((o) => o.status === "done").length,
    onHold: orders.filter((o) => o.status === "on_hold").length,
    doneToday: done.length,
    avgTurn: avg(done.map((o) => span(o.created_at, o.done_at)).filter((x) => x != null && x < 600)),
    avgWait: avg(done.map((o) => span(o.created_at, o.started_at)).filter((x) => x != null && x < 600)),
    late: orders.filter((o) => o.status !== "done" && timerLevel(o, now) === "late").length,
  };
}

// What the TV shows of a customer: first name and last initial, never a phone number.
export function shortName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

export const tireName = (o) => [o.tire_brand, o.tire_model].filter(Boolean).join(" ");

// "4 × 225/45R17" — what the tech pulls from the rack.
export function tireLine(o) {
  if (!o.tire_size) return "";
  return o.tire_qty ? `${o.tire_qty} × ${o.tire_size}` : o.tire_size;
}

// A booked appointment that hasn't arrived: { text: "In 25m" | "Due now" | "Late 15m", level }.
export function apptStatus(iso, now = Date.now()) {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m > 15) return { text: `In ${fmtMins(m)}`, level: "ok" };
  if (m >= -10) return { text: "Due now", level: "slow" };
  return { text: `Late ${fmtMins(-m)}`, level: "late" };
}
export const apptTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

// What the shop TVs get: names cut to first name + last initial, no phone numbers.
export function tvBoard({ orders, staff, todayDone, appointments, showAppointments = true }) {
  const techName = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  return {
    now: new Date().toISOString(),
    showAppointments,
    staff: staff.map((s) => ({ id: s.id, name: s.name })),
    todayDone,
    appointments: (appointments || []).map((a) => ({ id: a.id, customer: shortName(a.name), vehicle: a.vehicle, tire_size: a.tire_size, tire_qty: a.tire_qty, tire_name: a.tire_name, service: a.service, appointment_at: a.appointment_at })),
    orders: orders.map((o) => ({
      id: o.id, ticket_no: o.ticket_no, status: o.status, customer: shortName(o.customer_name),
      vehicle: o.vehicle, service: o.service, tire_size: o.tire_size, tire_qty: o.tire_qty, tire_brand: o.tire_brand, tire_model: o.tire_model, tire_img: o.tire_img, job_types: o.job_types || [], bay: o.bay,
      assigned_staff_id: o.assigned_staff_id, tech: techName[o.assigned_staff_id] || null,
      rush: !!o.rush, waiter: !!o.waiter, promised_at: o.promised_at, parts_status: o.parts_status,
      hold_reason: o.hold_reason, hold_since: o.hold_since,
      created_at: o.created_at, started_at: o.started_at, done_at: o.done_at,
    })),
  };
}

// The board the shop uses: Appointments (can be switched off), Checked in, Completed.
// A job that is in a bay or on hold still counts as checked in (it shows a small tag).
export const COLUMNS = [
  { k: "checked_in", l: "Checked in", icon: "login", c: "#2563eb", statuses: ["waiting", "in_bay", "on_hold"] },
  { k: "done", l: "Completed", icon: "check_circle", c: "#16a34a", statuses: ["done"] },
];
const BOARD_SLOW = { checked_in: [60, 90], done: [30, 60] };
// Time on the board's clock: since check-in while being worked on, since done once completed.
export function boardTimer(o, now = Date.now()) {
  const col = o.status === "done" ? "done" : "checked_in";
  const mins = minsSince(col === "done" ? o.done_at || o.created_at : o.created_at, now);
  const [slow, late] = BOARD_SLOW[col];
  const missed = col !== "done" && o.promised_at && new Date(o.promised_at).getTime() < now;
  return { mins, level: missed || mins >= late ? "late" : mins >= slow ? "slow" : "ok" };
}

// A tire from our shelf is a new tire (the shelf is the website's new-tire stock), so a job can't
// be both "used tires" and have a shelf tire. Fix a job's fields so they agree.
export function fixTireTypes(o) {
  const types = (o.job_types || []).filter((k) => k !== "used" || !o.tire_brand);
  if (o.tire_brand && !types.includes("tires")) types.unshift("tires");
  return { ...o, job_types: types };
}

// How long the bay TV shows "Undo" on a job someone just completed at the TV (and the server allows it).
export const TV_UNDO_MINS = 3;

// Why a job was taken off the board without being picked up (kept in its history, never deleted).
export const REMOVE_REASONS = [
  { k: "mistake", l: "Added by mistake" },
  { k: "duplicate", l: "Duplicate" },
  { k: "left", l: "Customer left / no service" },
  { k: "other", l: "Other" },
];
export const REMOVE_KEYS = REMOVE_REASONS.map((r) => r.k);

// ---- Tekmetric repair order ----
// A check-in carries the rest of a Tekmetric RO in `ro` (jsonb): customer email, plate, VIN, mileage in,
// the customer's concern, the tire price, labor lines (each under one of the job's types) and fees.
// Staff copy it into Tekmetric in Tekmetric's order: customer, vehicle, concern, jobs (parts + labor),
// fees, totals. Tax is left to Tekmetric.
export const EMPTY_RO = { email: "", plate: "", vin: "", mileage: "", concern: "", tire_price: "", labor: [], fees: [] };

const num = (v) => { const t = String(v ?? "").replace(/[$,\s]/g, ""); const n = t === "" ? NaN : Number(t); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
const money = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const clip = (v, max) => String(v ?? "").trim().slice(0, max);

// Server and demo: only the RO fields, trimmed and capped; prices as numbers (or null).
export function cleanRo(r) {
  if (!r || typeof r !== "object") return null;
  const line = (l) => ({ job: JOB_TYPE_KEYS.includes(l?.job) ? l.job : null, desc: clip(l?.desc, 120), price: num(l?.price) });
  const lines = (a) => (Array.isArray(a) ? a : []).slice(0, 12).map(line).filter((l) => l.desc || l.price != null);
  return {
    email: clip(r.email, 120), plate: clip(r.plate, 12).toUpperCase(), vin: clip(r.vin, 17).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    mileage: clip(r.mileage, 9).replace(/\D/g, ""), concern: clip(r.concern, 500), tire_price: num(r.tire_price),
    labor: lines(r.labor), fees: lines(r.fees).map(({ desc, price }) => ({ desc, price })),
  };
}

// The tire is the parts line of the job it belongs to: New tires, else Used tires, else Flat repair.
const TIRE_JOBS = ["tires", "used", "repair"];
const tireJob = (types) => TIRE_JOBS.find((k) => types.includes(k)) || types[0] || "tires";

// Jobs in the order they were picked, each with its parts and labor lines, plus the money.
export function roSheet(o) {
  const ro = { ...EMPTY_RO, ...(o.ro || {}) };
  const types = [...(o.job_types || [])];
  const labor = ro.labor || [];
  labor.forEach((l) => { if (l.job && !types.includes(l.job)) types.push(l.job); });
  const tire = tireName(o);
  const qty = Number(o.tire_qty) || (o.tire_size ? 1 : 0);
  const each = num(ro.tire_price);
  const part = o.tire_size || tire ? { qty, desc: [tire, o.tire_size].filter(Boolean).join(" "), each, total: each != null ? each * qty : null } : null;
  if (part && !types.length) types.push(tireJob(types));
  const first = types[0];
  const jobs = types.map((k) => ({
    k, name: JOB_TYPES.find((j) => j.k === k)?.l || k,
    parts: part && k === tireJob(types) ? [part] : [],
    labor: labor.filter((l) => (l.job || first) === k),
  }));
  const sum = (a) => a.reduce((s, x) => s + (x ?? 0), 0);
  const totals = { parts: part?.total || 0, labor: sum(labor.map((l) => num(l.price))), fees: sum((ro.fees || []).map((f) => num(f.price))) };
  totals.subtotal = totals.parts + totals.labor + totals.fees;
  return { ro, jobs, fees: ro.fees || [], totals };
}

// Plain text for Tekmetric, top to bottom in the RO's order. Blank fields are left out.
export function roText(o) {
  const { ro, jobs, fees, totals } = roSheet(o);
  const out = [];
  const block = (title, rows) => { const r = rows.filter(Boolean); if (r.length) out.push(title, ...r, ""); };
  block("CUSTOMER", [o.customer_name, o.phone, ro.email]);
  block("VEHICLE", [o.vehicle, ro.plate && `Plate: ${ro.plate}`, ro.vin && `VIN: ${ro.vin}`, ro.mileage && `Mileage in: ${Number(ro.mileage).toLocaleString("en-US")}`]);
  block("CONCERN", [ro.concern]);
  block("JOBS", jobs.flatMap((j, i) => [
    `${i + 1}. ${j.name}`,
    ...j.parts.map((p) => `   Part: ${p.qty} x ${p.desc}${p.each != null ? ` @ ${money(p.each)} = ${money(p.total)}` : ""}`),
    ...j.labor.map((l) => `   Labor: ${l.desc || "Labor"}${num(l.price) != null ? ` ${money(num(l.price))}` : ""}`),
  ]));
  block("FEES", fees.map((f) => `${f.desc || "Fee"}${num(f.price) != null ? ` ${money(num(f.price))}` : ""}`));
  if (totals.subtotal) block("TOTALS", [`Parts ${money(totals.parts)}`, `Labor ${money(totals.labor)}`, `Fees ${money(totals.fees)}`, `Subtotal ${money(totals.subtotal)} (before tax)`]);
  return out.join("\n").trim();
}
export { money as roMoney };
