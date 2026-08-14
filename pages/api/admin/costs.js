/**
 * Business costs (overhead) API — owner-gated. One endpoint, several actions:
 *   list    {}                                   -> all costs + monthly total + real margin
 *   save    { id?, label, category, amount, frequency }  -> insert or update one cost
 *   delete  { id }                                -> remove one cost
 *
 * The "margin" is pulled from the Weekly P&L the owner already uploads (pnl_invoices):
 * grossProfit / revenue over the last ~12 weeks. It lets the Costs tab turn a
 * profit-per-day target into a sales-per-day target ("how much to ring up").
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { computeInvoice } from "../../../lib/pnl/compute.js";
import { loadCostBook } from "../../../lib/pnl/store.js";

// Same forgiving number reader the P&L uses: "$1,140" -> 1140, junk -> NaN.
const parseAmount = (v) => {
  const s = String(v ?? "").replace(/[^0-9.\-]/g, "");
  if (s === "" || s === "-" || s === "." || s === "-.") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const FREQS = ["monthly", "weekly", "biweekly", "yearly", "one_time"];
const CATEGORIES = ["rent", "payroll", "marketing", "utilities", "insurance", "supplies", "other"];

// Convert any period's amount to a monthly figure. one_time is not recurring -> 0.
export function toMonthly(amount, frequency) {
  const a = Number(amount) || 0;
  switch (frequency) {
    case "weekly": return a * (52 / 12);
    case "biweekly": return a * (26 / 12);
    case "yearly": return a / 12;
    case "one_time": return 0;
    default: return a; // monthly
  }
}

// Real gross margin from the last ~12 weeks of uploaded P&L. Returns null margin if
// there's no P&L data yet (the tab then falls back to a manual margin the owner sets).
async function recentMargin() {
  const since = new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10);
  const { data } = await supabaseAdmin.from("pnl_invoices").select("*").gte("biz_date", since);
  if (!data || !data.length) return { marginPct: null, source: "none", revenue: 0, grossProfit: 0, days: 0 };
  const costByKey = await loadCostBook();
  let revenue = 0, grossProfit = 0;
  const days = new Set();
  for (const r of data) {
    const inv = {
      inv_no: r.inv_no, rep: r.rep, customer: r.customer, cust_type: r.cust_type,
      subtotal: Number(r.subtotal), tax: Number(r.tax), fet: Number(r.fet), total: Number(r.total),
      lines: r.lines || [],
    };
    const c = computeInvoice(inv, costByKey);
    revenue += c.retail;
    grossProfit += c.totalProfit;
    days.add(r.biz_date);
  }
  const marginPct = revenue > 0 ? grossProfit / revenue : null;
  return { marginPct, source: "pnl", revenue, grossProfit, days: days.size };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const auth = await requireAdmin(req);
  if (!auth.ok) return res.status(401).json({ error: "Unauthorized" });
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase not configured." });

  const { action } = req.body || {};
  try {
    if (action === "list" || !action) {
      const { data, error } = await supabaseAdmin
        .from("business_costs").select("*").eq("active", true)
        .order("category").order("created_at");
      if (error) {
        // Most likely the table doesn't exist yet — tell the owner exactly what to do.
        return res.status(200).json({ ok: false, needsSetup: true, error: error.message, costs: [] });
      }
      const costs = data || [];
      const monthlyRecurring = costs.reduce((s, c) => s + toMonthly(c.amount, c.frequency), 0);
      const oneTimeTotal = costs.filter((c) => c.frequency === "one_time").reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const margin = await recentMargin();
      return res.status(200).json({ ok: true, costs, monthlyRecurring, oneTimeTotal, margin });
    }

    if (action === "save") {
      const { id, label, category } = req.body;
      const frequency = FREQS.includes(req.body.frequency) ? req.body.frequency : "monthly";
      if (!label || !String(label).trim()) return res.status(400).json({ error: "Give the cost a name (e.g. Rent)." });
      const amount = parseAmount(req.body.amount);
      if (Number.isNaN(amount)) return res.status(400).json({ error: "Amount must be a number." });
      const row = {
        label: String(label).trim(),
        category: CATEGORIES.includes(category) ? category : "other",
        amount, frequency, active: true,
      };
      if (id) {
        const { error } = await supabaseAdmin.from("business_costs").update(row).eq("id", id);
        if (error) return res.status(500).json({ error: error.message });
      } else {
        const { error } = await supabaseAdmin.from("business_costs").insert(row);
        if (error) return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "delete") {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: "Missing id." });
      const { error } = await supabaseAdmin.from("business_costs").delete().eq("id", id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
