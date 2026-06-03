/**
 * Finance robot (P&L + tire-cost memory + AI insights). Owner/Google gated.
 *
 * POST actions:
 *   { action: "pnl", from, to, store_id }      -> full P&L for the period
 *   { action: "setCost", description, unit_cost, is_product }  -> remember a cost
 *   { action: "addExpense", expense } / { action: "deleteExpense", id }
 *   { action: "insights", from, to, store_id } -> AI finance-advisor narrative
 */
import { supabaseAdmin } from "../../../lib/supabaseAdmin.js";
import { requireAdmin } from "../../../lib/adminAuth.js";
import { normalizeDesc } from "../../../lib/tirebase.js";
import { computePnL, num } from "../../../lib/finance.js";

const MODEL = process.env.LEADS_AI_MODEL || "claude-sonnet-4-6";

async function askClaude(prompt, maxTokens = 600) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  return (data.content || []).map((b) => (b.type === "text" ? b.text : "")).join("").trim();
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
      const { error } = await supabaseAdmin.from("tire_costs").upsert({
        match_key: normalizeDesc(desc), label: desc, unit_cost: num(req.body.unit_cost),
        is_product: req.body.is_product !== false, updated_at: new Date().toISOString(),
      }, { onConflict: "match_key" });
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

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
    const to = req.body.to || today;
    const from = req.body.from || to;
    const store_id = req.body.store_id || 1;

    let pnl;
    try { pnl = await computePnL({ from, to, store_id }); }
    catch (e) { return res.status(502).json({ error: e.message || "Could not reach TireBase." }); }

    if (action === "insights") {
      if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "AI is not set up (missing key)." });
      const priced = pnl.products.filter((p) => p.hasCost);
      const top = priced.slice(0, 6).map((p) => `${p.label}: rev $${p.revenue}, margin $${p.margin} (${p.marginPct}%)`);
      const thin = [...priced].sort((a, b) => a.marginPct - b.marginPct).slice(0, 5).map((p) => `${p.label}: ${p.marginPct}%`);
      const unpriced = pnl.products.filter((p) => !p.hasCost).length;
      const prompt = `You are a sharp, plain-spoken finance advisor for The Tire Plug, an LA tire shop. Use ONLY these numbers — never invent data.

PERIOD: ${pnl.from} to ${pnl.to}
Revenue (pre-tax): $${pnl.revenue}
Tire/product cost (COGS): $${pnl.cogs}
Gross profit: $${pnl.gross} (${pnl.grossMargin}%)
Labor: $${pnl.labor}
Operating expenses: $${pnl.otherOpex}
NET PROFIT: $${pnl.net} (${pnl.netMargin}%)
Top items by revenue:
${top.join("\n") || "(none priced yet)"}
Thinnest margins:
${thin.join("\n") || "(none)"}
Items still missing a cost: ${unpriced}

Write a tight briefing for the owner:
- 2-3 sentences on where the money is and the headline (is the shop profitable, what's driving it).
- Then a blank line, then 3-5 bullets starting with "•": specific, concrete actions — thin-margin items to reprice, whether labor or expenses are too high as a % of revenue, the biggest profit drivers to push${unpriced ? ", and a note to enter the " + unpriced + " missing costs for accuracy" : ""}.
Keep it concrete and useful. Output ONLY the briefing.`;
      const insights = await askClaude(prompt);
      if (!insights) return res.status(502).json({ error: "AI returned nothing — try again." });
      return res.status(200).json({ insights });
    }

    return res.status(200).json(pnl);
  } catch (e) {
    return res.status(500).json({ error: "Server error." });
  }
}
