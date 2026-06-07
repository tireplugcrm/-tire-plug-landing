/**
 * Server-side persistence for the Weekly P&L tracker. Stores parsed invoices in
 * pnl_invoices and reads tire costs from the shared tire_costs table, then runs the
 * pure compute functions so every read reflects the latest costs.
 */
import { supabaseAdmin } from "../supabaseAdmin.js";
import { computeDay, computeWeek } from "./compute.js";

export async function loadCostBook() {
  const { data } = await supabaseAdmin.from("tire_costs").select("match_key, unit_cost");
  return Object.fromEntries((data || []).map((c) => [c.match_key, c]));
}

// Replace a day's stored invoices (upload is idempotent — re-uploading overwrites).
export async function saveDayInvoices(date, invoices) {
  await supabaseAdmin.from("pnl_invoices").delete().eq("biz_date", date);
  const rows = invoices.map((inv) => ({
    biz_date: date, inv_no: inv.inv_no, detail_no: inv.detail_no || null,
    rep: inv.rep, customer: inv.customer, cust_type: inv.cust_type,
    payment_method: inv.payment_method || null,
    subtotal: inv.subtotal, tax: inv.tax, fet: inv.fet || 0, total: inv.total,
    lines: inv.lines || [], matched: !!inv.matched,
  }));
  if (rows.length) {
    const { error } = await supabaseAdmin.from("pnl_invoices").insert(rows);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

function rowToInvoice(r) {
  return {
    inv_no: r.inv_no, detail_no: r.detail_no, rep: r.rep, customer: r.customer,
    cust_type: r.cust_type, payment_method: r.payment_method,
    subtotal: Number(r.subtotal), tax: Number(r.tax), fet: Number(r.fet), total: Number(r.total),
    lines: r.lines || [], matched: r.matched,
  };
}

export async function getDay(date, costByKey) {
  const costs = costByKey || (await loadCostBook());
  const { data } = await supabaseAdmin.from("pnl_invoices").select("*").eq("biz_date", date).order("inv_no");
  const invoices = (data || []).map(rowToInvoice);
  return computeDay({ date, invoices }, costs);
}

export function weekDates(start) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < 7; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export async function getWeek(start) {
  const costByKey = await loadCostBook();
  const dates = weekDates(start);
  const days = [];
  for (const date of dates) days.push(await getDay(date, costByKey));
  return { start, dates, days, summary: computeWeek(days) };
}

// Which days already have data (for the calendar/sidebar).
export async function loadedDates(from, to) {
  let q = supabaseAdmin.from("pnl_invoices").select("biz_date");
  if (from) q = q.gte("biz_date", from);
  if (to) q = q.lte("biz_date", to);
  const { data } = await q;
  return [...new Set((data || []).map((r) => r.biz_date))].sort();
}
