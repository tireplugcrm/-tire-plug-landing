/**
 * Junior's Pay Tracker (server-only). See lib/junior-pay-schema.sql.
 * Every Saturday and Sunday is a shift (default hours = shop hours that day, lib/shop.js HOURS)
 * unless rep_shifts says otherwise. His ROs are commission_reports rows with rep = 'Junior';
 * commission = labor x commission_rate (5%, same as Lexi). Paid on the 1st for the month before.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { setting, shopDay } from "./invoices.js";
import { rate } from "./commission.js";
import { HOURS } from "./shop.js";

export const REP = "Junior";
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Hours a weekend day counts until real hours are entered: his usual shift (app_settings emilio_usual,
 * e.g. {"6": 8.5, "0": 6} = Sat 10-7 less a 30 min lunch, Sun 10-4), else the shop's hours that day.
 */
export function defaultHours(weekday, usual = {}) {
  if (usual[weekday] != null && Number.isFinite(Number(usual[weekday]))) return Number(usual[weekday]);
  const h = HOURS.find((x) => x.days.includes(weekday));
  if (!h) return 0;
  const t = (s) => +s.slice(0, 2) + +s.slice(3, 5) / 60;
  return t(h.closes) - t(h.opens);
}

const iso = (d) => d.toISOString().slice(0, 10);
const dow = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();

/** Every Sat/Sun in month 'YYYY-MM'. */
export function weekendDays(month) {
  const out = [];
  const d = new Date(`${month}-01T12:00:00Z`);
  while (iso(d).slice(0, 7) === month) {
    if ([0, 6].includes(d.getUTCDay())) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function nextMonth(month) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return iso(d).slice(0, 7);
}

/**
 * Build a month from raw rows (shared by the live and demo paths).
 * shifts: rep_shifts rows, ros: commission_reports rows, payout: rep_payouts row or null.
 */
export function buildMonth({ month, today, start, hourly, pct, shifts, ros, payout, usual = {} }) {
  const byDay = new Map(shifts.map((s) => [String(s.day).slice(0, 10), s]));
  const days = weekendDays(month).filter((d) => !start || d >= start).map((day) => {
    const s = byDay.get(day);
    const hours = s ? Number(s.hours) : defaultHours(dow(day), usual);
    const dayRos = ros.filter((r) => String(r.day).slice(0, 10) === day).map((r) => ({
      id: r.id, ro_number: r.ro_number, ro_name: r.ro_name, status: r.status,
      // Hand-matched commission-tracker rows can have commission but no labor_total: labor = commission / rate.
      labor: r.labor_total != null ? r2(r.labor_total) : r.commission != null && pct ? r2(Number(r.commission) / pct) : 0,
      sold: r2(r.sold_total),
      commission: r.commission != null ? r2(r.commission) : pct == null ? 0 : r2(Number(r.labor_total || 0) * pct),
      notes: r.notes || null,
    }));
    const commission = r2(dayRos.reduce((t, x) => t + x.commission, 0));
    const base = r2(hours * hourly);
    return {
      day, weekday: dow(day), hours, confirmed: !!s, note: s?.note || null,
      past: day <= today, base, commission, labor: r2(dayRos.reduce((t, x) => t + x.labor, 0)),
      total: r2(base + commission), ros: dayRos,
    };
  });
  const worked = days.filter((d) => d.past);
  const sum = (list, k) => r2(list.reduce((t, x) => t + x[k], 0));
  const due = nextMonth(month);
  return {
    month, today, hourly, pct, start,
    days,
    toDate: { shifts: worked.filter((d) => d.hours > 0).length, hours: sum(worked, "hours"), base: sum(worked, "base"), commission: sum(worked, "commission"), labor: sum(worked, "labor"), total: sum(worked, "total"), ros: worked.reduce((t, d) => t + d.ros.length, 0) },
    projected: { hours: sum(days, "hours"), total: sum(days, "total") },
    unconfirmed: worked.filter((d) => !d.confirmed).length,
    dueOn: `${due}-01`,
    complete: today >= `${due}-01`,
    payout: payout ? { amount: r2(payout.amount), paid_at: payout.paid_at } : null,
  };
}

export async function monthState(month) {
  const today = shopDay(0);
  month = /^\d{4}-\d{2}$/.test(month || "") ? month : today.slice(0, 7);
  const from = `${month}-01`, to = `${nextMonth(month)}-01`;
  const [hourlyS, start, usualS, pct, shifts, ros, payout] = await Promise.all([
    setting("emilio_hourly"), setting("emilio_start"), setting("emilio_usual"), rate(),
    supabaseAdmin.from("rep_shifts").select("*").eq("rep", REP).gte("day", from).lt("day", to).then((r) => r.data || []),
    supabaseAdmin.from("commission_reports").select("*").eq("rep", REP).gte("day", from).lt("day", to).order("created_at").then((r) => r.data || []),
    supabaseAdmin.from("rep_payouts").select("*").eq("rep", REP).eq("month", from).maybeSingle().then((r) => r.data),
  ]);
  let usual = {};
  try { usual = JSON.parse(usualS || "{}"); } catch { usual = {}; }
  return buildMonth({ month, today, start: start || null, hourly: parseFloat(hourlyS) || 0, pct: pct ?? 0.05, shifts, ros, payout, usual });
}

/* ---- the 4-digit code, with a lock after too many wrong tries ---- */
const MAX_TRIES = 6, LOCK_MIN = 15;

export async function checkCode(code) {
  const real = String(await setting("emilio_code")).trim();
  if (!/^\d{4}$/.test(real)) return { ok: false, error: "The code isn't set up yet." };
  let lock = {};
  try { lock = JSON.parse((await setting("emilio_lock")) || "{}"); } catch { lock = {}; }
  if (lock.until && Date.now() < lock.until) return { ok: false, error: `Too many tries. Wait ${Math.ceil((lock.until - Date.now()) / 60000)} min.` };
  const save = (v) => supabaseAdmin.from("app_settings").upsert({ key: "emilio_lock", value: JSON.stringify(v), updated_at: new Date().toISOString() });
  if (String(code) === real) {
    if (lock.tries) await save({});
    return { ok: true };
  }
  const tries = (lock.until && Date.now() >= lock.until ? 0 : lock.tries || 0) + 1;
  await save(tries >= MAX_TRIES ? { tries, until: Date.now() + LOCK_MIN * 60000 } : { tries });
  return { ok: false, error: "Wrong code." };
}

/* ---- demo month for previews (no database) ---- */
export function demoState(month) {
  const today = "2026-11-09";
  month = /^\d{4}-\d{2}$/.test(month || "") ? month : "2026-11";
  const ro = (day, n, name, labor) => ({ id: `${day}-${n}`, day, ro_number: String(n), ro_name: name, status: "matched", labor_total: labor, sold_total: labor * 4.2 });
  const ros = month === "2026-11" ? [
    ro("2026-11-07", 31840, "Maria Gonzalez", 120), ro("2026-11-07", 31846, "Kevin Tran", 95), ro("2026-11-07", 31851, "Luis Ortega", 160),
    ro("2026-11-08", 31872, "Ana Ruiz", 140), ro("2026-11-08", 31877, "James Park", 80),
  ] : [];
  const shifts = month === "2026-11" ? [{ day: "2026-11-07", hours: 8.5, note: "10 AM-7 PM, 30 min lunch" }, { day: "2026-11-08", hours: 6, note: "10 AM-4 PM" }] : [];
  return buildMonth({ month, today, start: "2026-11-07", hourly: 22, pct: 0.05, shifts, ros, payout: null, usual: { 6: 8.5, 0: 6 } });
}
