/**
 * Belen's field-rep bonus (server-only). See lib/belen-schema.sql for the plan and tables.
 * A month = her accounts, the profit logged on them that month, and the bonus it earns.
 *
 * Bonus math (app_settings belen_plan, defaults below):
 *   intro months (the month starts before belen_start + 90 days):
 *     introRate x new-account profit + existingRate x existing-account profit, from the first dollar
 *   after that: only profit above the line pays. The part above the line is split across new and
 *   existing profit in proportion, so bonus = (above / total) x (rate x new + existingRate x existing)
 *   plus newAccountBonus for each new account that qualified that month.
 * Paid on the first payday of the next month.
 */
import { supabaseAdmin } from "./supabaseAdmin.js";
import { setting, shopDay } from "./invoices.js";

export const REP = "Belen";
// What a paid job was, and which part of the business it belongs to.
export const SECTORS = {
  scrap: "Scrap2Cash",   // businesses selling us aluminum wheels
  wholesale: "Wholesale", // tires sold to businesses (carry-out, no install on commercial)
  retail: "Retail",       // businesses using our shop: tire changes, mechanic work, fleet service
};
export const KINDS = {
  wheels: "Scrap2Cash · aluminum wheels",
  tires: "Wholesale · tires for a business",
  commercial: "Wholesale · commercial truck tires",
  fleet: "Retail · tire changes & mechanic work",
};
export const SECTOR_OF = { wheels: "scrap", tires: "wholesale", commercial: "wholesale", fleet: "retail" };
const DEFAULT_PLAN = { line: 5000, rate: 0.15, existingRate: 0.05, introRate: 0.10, introDays: 90, newAccountBonus: 50, hourly: 27.5 };
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);

export function nextMonth(month) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return iso(d).slice(0, 7);
}
function addDays(day, n) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); }

/** Build a month from raw rows (shared by the live and demo paths). */
export function buildMonth({ month, today, start, plan, accounts, profit, payout }) {
  plan = { ...DEFAULT_PLAN, ...plan };
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const introEnd = start ? addDays(start, plan.introDays) : null;
  const intro = !!introEnd && `${month}-01` < introEnd;

  const rows = profit.map((p) => {
    const a = byId.get(p.account_id) || {};
    return { id: p.id, day: String(p.day).slice(0, 10), account_id: p.account_id, account: a.name || "(removed)", existing: !!a.existing, kind: p.kind, ref: p.ref || null, profit: r2(p.profit), note: p.note || null };
  }).sort((x, y) => (x.day < y.day ? 1 : -1));

  const newProfit = r2(rows.filter((r) => !r.existing).reduce((t, r) => t + r.profit, 0));
  const existingProfit = r2(rows.filter((r) => r.existing).reduce((t, r) => t + r.profit, 0));
  const total = r2(newProfit + existingProfit);
  const above = intro ? total : Math.max(0, total - plan.line);
  const share = total > 0 ? above / total : 0;
  const fromNew = r2(share * newProfit * (intro ? plan.introRate : plan.rate));
  const fromExisting = r2(share * existingProfit * plan.existingRate);
  const qualified = accounts.filter((a) => !a.existing && a.qualified_on && String(a.qualified_on).slice(0, 7) === month);
  const newAccounts = r2(qualified.length * plan.newAccountBonus);
  const bonus = r2(fromNew + fromExisting + newAccounts);

  // Per account, this month: profit and the bonus it earned (account bonuses included).
  const perAccount = accounts.map((a) => {
    const p = r2(rows.filter((r) => r.account_id === a.id).reduce((t, r) => t + r.profit, 0));
    const earned = r2(share * p * (a.existing ? plan.existingRate : intro ? plan.introRate : plan.rate) + (qualified.includes(a) ? plan.newAccountBonus : 0));
    return {
      id: a.id, name: a.name, kind: a.kind, existing: !!a.existing, contact: a.contact || null, phone: a.phone || null, notes: a.notes || null,
      signed_on: a.signed_on ? String(a.signed_on).slice(0, 10) : null, qualified_on: a.qualified_on ? String(a.qualified_on).slice(0, 10) : null,
      profit: p, earned, entries: rows.filter((r) => r.account_id === a.id).length,
    };
  }).sort((x, y) => y.profit - x.profit || (x.name < y.name ? -1 : 1));

  // Profit by part of the business (each paid job counts in the sector of what it was).
  const sectors = Object.keys(SECTORS).map((id) => {
    const list = rows.filter((r) => (SECTOR_OF[r.kind] || "retail") === id);
    return { id, name: SECTORS[id], profit: r2(list.reduce((t, r) => t + r.profit, 0)), jobs: list.length };
  });

  const due = nextMonth(month);
  return {
    sectors,
    month, today, start, plan, intro, introEnd,
    totals: { total, newProfit, existingProfit, line: intro ? 0 : plan.line, above: r2(above), fromNew, fromExisting, newAccounts, qualified: qualified.length, bonus },
    toLine: intro ? 0 : r2(Math.max(0, plan.line - total)),
    accounts: perAccount,
    entries: rows,
    dueMonth: due,
    complete: today >= `${due}-01`,
    payout: payout ? { amount: r2(payout.amount), paid_at: payout.paid_at } : null,
  };
}

export async function monthState(month) {
  const today = shopDay(0);
  month = /^\d{4}-\d{2}$/.test(month || "") ? month : today.slice(0, 7);
  const from = `${month}-01`, to = `${nextMonth(month)}-01`;
  const [start, planS, accounts, profit, payout] = await Promise.all([
    setting("belen_start"), setting("belen_plan"),
    supabaseAdmin.from("rep_accounts").select("*").eq("rep", REP).order("signed_on").then((r) => { if (r.error) throw new Error(`${r.error.message}. Run lib/belen-schema.sql in Supabase first.`); return r.data || []; }),
    supabaseAdmin.from("rep_profit").select("*").eq("rep", REP).gte("day", from).lt("day", to).then((r) => r.data || []),
    supabaseAdmin.from("rep_payouts").select("*").eq("rep", REP).eq("month", from).maybeSingle().then((r) => r.data),
  ]);
  let plan = {};
  try { plan = JSON.parse(planS || "{}"); } catch { plan = {}; }
  return buildMonth({ month, today, start: start || null, plan, accounts, profit, payout });
}

/* ---- demo month for previews (no database) ---- */
export function demoState(month) {
  month = /^\d{4}-\d{2}$/.test(month || "") ? month : "2026-11";
  const accounts = [
    { id: "a1", name: "Eastside Towing", kind: "wheels", existing: false, contact: "Ray", signed_on: "2026-11-10", qualified_on: "2026-11-18" },
    { id: "a2", name: "USC Fleet Services", kind: "fleet", existing: true, contact: "Fleet desk", signed_on: "2026-11-10" },
    { id: "a3", name: "Olympic Produce Co.", kind: "tires", existing: false, signed_on: "2026-11-14" },
    { id: "a4", name: "Pacific Heavy Tow", kind: "commercial", existing: false, signed_on: "2026-11-20" },
  ];
  const e = (id, day, account_id, kind, ref, profit) => ({ id, day, account_id, kind, ref, profit });
  const profit = month === "2026-11" ? [
    e("p1", "2026-11-12", "a1", "wheels", "Scrap 1182", 168), e("p2", "2026-11-19", "a1", "wheels", "Scrap 1197", 224),
    e("p3", "2026-11-13", "a2", "fleet", "RO 31902", 640), e("p4", "2026-11-21", "a2", "fleet", "RO 31960", 410),
    e("p5", "2026-11-17", "a3", "tires", "RO 31931", 80), e("p6", "2026-11-24", "a4", "commercial", "INV 5521", 210),
  ] : [];
  return buildMonth({ month, today: "2026-11-25", start: "2026-11-10", plan: {}, accounts, profit, payout: null });
}
