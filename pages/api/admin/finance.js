/**
 * Finance robot (P&L + tire-cost memory). Owner/Google gated.
 *
 * POST actions:
 *   { action: "pnl", from, to, store_id }     -> full P&L for the period
 *   { action: "setCost", description, unit_cost, is_product }  -> remember a cost
 *   { action: "addExpense", expense }          -> add an operating cost
 *   { action: "deleteExpense", id }            -> remove one
 *
 * Revenue = sum of line subtotals (pre-tax; tax is a passthrough, excluded).
 * COGS = matched unit costs × qty. Gross = Revenue − COGS.
 * Labor = hours×rate + logged commission (from the HR module).
 * Net = Gross − Labor − other operating expenses.
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { fetchOrderLines, normalizeDesc } from "../../../lib/tirebase.js";

function num(v) { const n = Number(String(v == null ? 0 : v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }
function r2(n) { return Math.round(n * 100) / 100; }

// Distinct calendar months (YYYY-MM) touched by [from, to], for monthly expenses.
function monthsBetween(from, to) {
  const set = new Set();
  const d = new Date(`${from}T00:00:00Z`); const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) { set.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`); d.setUTCMonth(d.getUTCMonth() + 1); }
  return Math.max(1, set.size);
}

async function computeLabor(from, to) {
  const fromISO = `${from}T00:00:00.000Z`;
  const toEx = new Date(`${to}T00:00:00.000Z`); toEx.setUTCDate(toEx.getUTCDate() + 1);
  const toISO = toEx.toISOString();
  const { data: staff } = await supabaseAdmin.from("staff").select("id, hourly_rate");
  const rateById = Object.fromEntries((staff || []).map((s) => [s.id, num(s.hourly_rate)]));
  const { data: punches } = await supabaseAdmin.from("time_punches").select("staff_id, clock_in, clock_out").gte("clock_in", fromISO).lt("clock_in", toISO);
  const now = new Date();
  let base = 0;
  for (const p of punches || []) {
    const end = p.clock_out ? new Date(p.clock_out) : now;
    const hrs = Math.max(0, (end - new Date(p.clock_in)) / 3600000);
    base += hrs * (rateById[p.staff_id] || 0);
  }
  const { data: logs } = await supabaseAdmin.from("service_log").select("amount").gte("logged_at", fromISO).lt("logged_at", toISO);
  const commission = (logs || []).reduce((s, l) => s + num(l.amount), 0);
  return r2(base + commission);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};

  try {
    if (action === "setCost") {
      const desc = req.body.description;
      if (!desc) return res.status(400).json({ error: "Missing description." });
      const row = {
        match_key: normalizeDesc(desc),
        label: desc,
        unit_cost: num(req.body.unit_cost),
        is_product: req.body.is_product !== false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseAdmin.from("tire_costs").upsert(row, { onConflict: "match_key" });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (action === "addExpense") {
      const e = req.body.expense || {};
      if (!e.label || e.amount == null) return res.status(400).json({ error: "Need a label and amount." });
      const { error } = await supabaseAdmin.from("business_costs").insert({
        label: e.label, category: e.category || "other", amount: num(e.amount),
        frequency: e.frequency === "one_time" ? "one_time" : "monthly", cost_date: e.cost_date || null,
      });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
    if (action === "deleteExpense") {
      const { error } = await supabaseAdmin.from("business_costs").delete().eq("id", req.body.id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    // ---- P&L ----
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    const to = req.body.to || today;
    const from = req.body.from || to;
    const store_id = req.body.store_id || 1;

    let rows;
    try { rows = await fetchOrderLines({ from, to, store_id }); }
    catch (e) { return res.status(502).json({ error: e.message || "Could not reach TireBase." }); }

    // Cost memory
    const { data: costs } = await supabaseAdmin.from("tire_costs").select("match_key, unit_cost, is_product");
    const costByKey = Object.fromEntries((costs || []).map((c) => [c.match_key, c]));

    // Group lines by normalized description
    const prod = {};
    for (const row of rows) {
      const desc = row.description || "(no description)";
      const key = normalizeDesc(desc);
      const qty = num(row.quantity) || 0;
      const rev = num(row.subtotal) || num(row.unit_price) * qty;
      const p = prod[key] || (prod[key] = { key, label: desc, qty: 0, revenue: 0 });
      p.qty += qty; p.revenue += rev;
    }

    let revenue = 0, cogs = 0;
    const products = Object.values(prod).map((p) => {
      revenue += p.revenue;
      const c = costByKey[p.key];
      const hasCost = !!c;
      const cost = hasCost ? num(c.unit_cost) * p.qty : 0;
      if (hasCost) cogs += cost;
      const margin = p.revenue - cost;
      return {
        key: p.key, label: p.label, qty: r2(p.qty), revenue: r2(p.revenue),
        unit_cost: hasCost ? num(c.unit_cost) : null, cost: r2(cost), margin: r2(margin),
        marginPct: p.revenue ? Math.round((margin / p.revenue) * 100) : 0, hasCost,
      };
    }).sort((a, b) => b.revenue - a.revenue);

    revenue = r2(revenue); cogs = r2(cogs);
    const gross = r2(revenue - cogs);

    const labor = await computeLabor(from, to);

    const { data: expenses } = await supabaseAdmin.from("business_costs").select("*").eq("active", true);
    const months = monthsBetween(from, to);
    let otherOpex = 0;
    for (const e of expenses || []) {
      if (e.frequency === "one_time") {
        if (e.cost_date && e.cost_date >= from && e.cost_date <= to) otherOpex += num(e.amount);
      } else {
        otherOpex += num(e.amount) * months;
      }
    }
    otherOpex = r2(otherOpex);

    const net = r2(gross - labor - otherOpex);

    return res.status(200).json({
      from, to, months,
      revenue, cogs, gross, grossMargin: revenue ? Math.round((gross / revenue) * 100) : 0,
      labor, otherOpex, net, netMargin: revenue ? Math.round((net / revenue) * 100) : 0,
      products, expenses: expenses || [],
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
